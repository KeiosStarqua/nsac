import type { Database } from "bun:sqlite";
import { dbSqlite } from "../client";

// Live health state (SPEC §14 v2, PR2). Bảng mới, KHÔNG đụng `health_observations` (seed lịch sử).
// - `health_current`: UPSERT latest theo (astronaut, metric) — quality đã lọc invalid ở projector.
// - `health_rollups`: 1m aggregate ghi tại ingest; 1h tính on-the-fly từ 1m (không lưu row 1h).

export type HealthQuality = "valid" | "suspect" | "invalid";
export type HealthRollupBucket = "1m" | "1h";

/** Sentinel cho metric cabin/mission-scoped (env, CANS) — không thuộc một phi hành gia. */
export const MISSION_SCOPE = "MISSION";

export interface HealthCurrentRow {
  astronautId: string;
  metric: string;
  value: number;
  unit: string;
  quality: HealthQuality;
  /** `sim` ở v2 — nguồn duy nhất ghi bảng này. */
  source: string;
  /** observed_at của telemetry (UTC ISO-8601) — thời điểm đo theo sim clock. */
  measuredAt: string;
  /** Wall clock ms lúc ingest (freshness check của /api/health/live). */
  updatedAt: number;
}

export interface MinuteRollupInput {
  scope: string;
  metric: string;
  /** Epoch ms bắt đầu bucket 1 phút (đã floor 60_000). */
  bucketStart: number;
  value: number;
  quality: HealthQuality;
}

export interface HealthRollupRow {
  scope: string;
  metric: string;
  bucket: HealthRollupBucket;
  bucketStart: number;
  valueMin: number;
  valueMax: number;
  valueAvg: number;
  valueCount: number;
  qualityWorst: HealthQuality;
}

export interface HealthLiveStore {
  upsertCurrent(rows: HealthCurrentRow[]): void;
  currentByAstronaut(astronautId: string): HealthCurrentRow[];
  maxUpdatedAt(astronautId: string): number | null;
  upsertMinuteRollups(rows: MinuteRollupInput[]): void;
  rollups(opts: {
    scope?: string;
    metric?: string;
    bucket?: HealthRollupBucket;
    from?: number;
    to?: number;
  }): HealthRollupRow[];
  /** 1h rollups tính từ row 1m (max 1 giờ không lưu trong DB). */
  hourlyFromMinute(opts: { scope?: string; metric?: string; from?: number; to?: number }): HealthRollupRow[];
  countCurrent(): number;
  clear(): void;
}

interface CurrentDbRow {
  astronaut_id: string;
  metric: string;
  value: number;
  unit: string;
  quality: string;
  source: string;
  measured_at: string;
  updated_at: number;
}

interface RollupDbRow {
  scope: string;
  metric: string;
  bucket: string;
  bucket_start: number;
  value_min: number;
  value_max: number;
  value_avg: number;
  value_count: number;
  quality_worst: string;
}

function toCurrent(row: CurrentDbRow): HealthCurrentRow {
  return {
    astronautId: row.astronaut_id,
    metric: row.metric,
    value: row.value,
    unit: row.unit,
    quality: row.quality as HealthQuality,
    source: row.source,
    measuredAt: row.measured_at,
    updatedAt: row.updated_at,
  };
}

function toRollup(row: RollupDbRow): HealthRollupRow {
  return {
    scope: row.scope,
    metric: row.metric,
    bucket: row.bucket as HealthRollupBucket,
    bucketStart: row.bucket_start,
    valueMin: row.value_min,
    valueMax: row.value_max,
    valueAvg: row.value_avg,
    valueCount: row.value_count,
    qualityWorst: row.quality_worst as HealthQuality,
  };
}

export class SqliteHealthLiveStore implements HealthLiveStore {
  constructor(private readonly sqlite: Database) {}

  upsertCurrent(rows: HealthCurrentRow[]): void {
    if (rows.length === 0) return;
    const stmt = this.sqlite.query(
      `INSERT INTO health_current (astronaut_id, metric, value, unit, quality, source, measured_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(astronaut_id, metric) DO UPDATE SET
         value = excluded.value,
         unit = excluded.unit,
         quality = excluded.quality,
         source = excluded.source,
         measured_at = excluded.measured_at,
         updated_at = excluded.updated_at`,
    );
    this.sqlite.transaction(() => {
      for (const row of rows) {
        stmt.run(
          row.astronautId,
          row.metric,
          row.value,
          row.unit,
          row.quality,
          row.source,
          row.measuredAt,
          row.updatedAt,
        );
      }
    })();
  }

  currentByAstronaut(astronautId: string): HealthCurrentRow[] {
    const rows = this.sqlite
      .query("SELECT * FROM health_current WHERE astronaut_id = ? ORDER BY metric ASC")
      .all(astronautId) as CurrentDbRow[];
    return rows.map(toCurrent);
  }

  maxUpdatedAt(astronautId: string): number | null {
    const row = this.sqlite
      .query("SELECT max(updated_at) AS ts FROM health_current WHERE astronaut_id = ?")
      .get(astronautId) as { ts: number | null } | null;
    return row?.ts ?? null;
  }

  upsertMinuteRollups(rows: MinuteRollupInput[]): void {
    if (rows.length === 0) return;
    // Aggregation trong SQL: min/max, weighted average, worst quality (invalid > suspect > valid).
    const stmt = this.sqlite.query(
      `INSERT INTO health_rollups
         (scope, metric, bucket, bucket_start, value_min, value_max, value_avg, value_count, quality_worst)
       VALUES (?, ?, '1m', ?, ?, ?, ?, 1, ?)
       ON CONFLICT(scope, metric, bucket, bucket_start) DO UPDATE SET
         value_min = min(health_rollups.value_min, excluded.value_min),
         value_max = max(health_rollups.value_max, excluded.value_max),
         value_avg = ((health_rollups.value_avg * health_rollups.value_count) + (excluded.value_avg * excluded.value_count))
                     / (health_rollups.value_count + excluded.value_count),
         value_count = health_rollups.value_count + excluded.value_count,
         quality_worst = CASE
           WHEN health_rollups.quality_worst = 'invalid' OR excluded.quality_worst = 'invalid' THEN 'invalid'
           WHEN health_rollups.quality_worst = 'suspect' OR excluded.quality_worst = 'suspect' THEN 'suspect'
           ELSE 'valid' END`,
    );
    this.sqlite.transaction(() => {
      for (const row of rows) {
        stmt.run(row.scope, row.metric, row.bucketStart, row.value, row.value, row.value, row.quality);
      }
    })();
  }

  rollups(opts: { scope?: string; metric?: string; bucket?: HealthRollupBucket; from?: number; to?: number }): HealthRollupRow[] {
    const conditions: string[] = [];
    const params: Array<string | number> = [];
    if (opts.scope) {
      conditions.push("scope = ?");
      params.push(opts.scope);
    }
    if (opts.metric) {
      conditions.push("metric = ?");
      params.push(opts.metric);
    }
    conditions.push("bucket = ?");
    params.push(opts.bucket ?? "1m");
    if (opts.from !== undefined) {
      conditions.push("bucket_start >= ?");
      params.push(opts.from);
    }
    if (opts.to !== undefined) {
      conditions.push("bucket_start < ?");
      params.push(opts.to);
    }
    const rows = this.sqlite
      .query(`SELECT * FROM health_rollups WHERE ${conditions.join(" AND ")} ORDER BY scope, metric, bucket_start ASC`)
      .all(...params) as RollupDbRow[];
    return rows.map(toRollup);
  }

  hourlyFromMinute(opts: { scope?: string; metric?: string; from?: number; to?: number }): HealthRollupRow[] {
    const conditions: string[] = ["bucket = '1m'"];
    const params: Array<string | number> = [];
    if (opts.scope) {
      conditions.push("scope = ?");
      params.push(opts.scope);
    }
    if (opts.metric) {
      conditions.push("metric = ?");
      params.push(opts.metric);
    }
    if (opts.from !== undefined) {
      conditions.push("bucket_start >= ?");
      params.push(opts.from);
    }
    if (opts.to !== undefined) {
      conditions.push("bucket_start < ?");
      params.push(opts.to);
    }
    const rows = this.sqlite
      .query(
        `SELECT scope, metric, '1h' AS bucket,
                (bucket_start / 3600000) * 3600000 AS bucket_start,
                min(value_min) AS value_min,
                max(value_max) AS value_max,
                sum(value_avg * value_count) / sum(value_count) AS value_avg,
                sum(value_count) AS value_count,
                CASE
                  WHEN sum(CASE WHEN quality_worst = 'invalid' THEN 1 ELSE 0 END) > 0 THEN 'invalid'
                  WHEN sum(CASE WHEN quality_worst = 'suspect' THEN 1 ELSE 0 END) > 0 THEN 'suspect'
                  ELSE 'valid' END AS quality_worst
         FROM health_rollups
         WHERE ${conditions.join(" AND ")}
         GROUP BY scope, metric, (bucket_start / 3600000)
         ORDER BY scope, metric, bucket_start ASC`,
      )
      .all(...params) as RollupDbRow[];
    return rows.map(toRollup);
  }

  countCurrent(): number {
    const row = this.sqlite.query("SELECT count(*) AS n FROM health_current").get() as { n: number } | null;
    return row?.n ?? 0;
  }

  clear(): void {
    this.sqlite.transaction(() => {
      this.sqlite.query("DELETE FROM health_current").run();
      this.sqlite.query("DELETE FROM health_rollups").run();
    })();
  }
}

/** Singleton production — connection chung `db` (client.ts) cùng `health_observations`. */
export const healthLiveRepo = new SqliteHealthLiveStore(dbSqlite);
