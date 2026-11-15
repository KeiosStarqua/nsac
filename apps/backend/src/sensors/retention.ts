// Retention cho `telemetry_events` (SPEC §14 — Continuous runtime v2, PR5).
//
// Grader/production demo chạy 24/7 ở 1 Hz × 13 thiết bị ⇒ cần TTL. Env:
//   SKY_TELEMETRY_RETENTION_DAYS (default 3), SKY_TELEMETRY_MAX_ROWS (default 1_500_000).
// Xoá theo batch ≤50k row/statement (không khoá DB lâu), transaction cho mỗi lần prune.
// Best-effort: caller (runtime) bọc try/catch — prune không bao giờ được làm chết sim.

import type { Database } from "bun:sqlite";
import { sensorsSqlite } from "../db/sensorsClient";

export const DEFAULT_RETENTION_DAYS = 3;
export const DEFAULT_MAX_ROWS = 1_500_000;
const DELETE_BATCH = 50_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.trunc(raw);
}

export interface PruneOptions {
  retentionDays?: number;
  maxRows?: number;
  /** Wall clock ms — test truyền mốc cố định. */
  now?: number;
  /** Handle khác (test dựng DB riêng). Mặc định connection SENSORS. */
  db?: Database;
  log?: (line: string) => void;
}

export interface PruneResult {
  deleted: number;
  remaining: number;
}

export function pruneTelemetry(opts: PruneOptions = {}): PruneResult {
  const db = opts.db ?? sensorsSqlite;
  const now = opts.now ?? Date.now();
  const log = opts.log ?? ((line: string) => console.log(line));
  const retentionDays = opts.retentionDays ?? envInt("SKY_TELEMETRY_RETENTION_DAYS", DEFAULT_RETENTION_DAYS);
  const maxRows = opts.maxRows ?? envInt("SKY_TELEMETRY_MAX_ROWS", DEFAULT_MAX_ROWS);

  // received_at là UTC ISO-8601 cố định độ dài ⇒ so sánh chuỗi = so sánh thời gian.
  const cutoff = new Date(now - retentionDays * DAY_MS).toISOString();
  const deleteAged = db.query(
    "DELETE FROM telemetry_events WHERE event_id IN (SELECT event_id FROM telemetry_events WHERE received_at < ? LIMIT ?)",
  );
  const deleteOldest = db.query(
    "DELETE FROM telemetry_events WHERE event_id IN (SELECT event_id FROM telemetry_events ORDER BY received_at ASC, event_id ASC LIMIT ?)",
  );
  const countRows = db.query("SELECT count(*) AS n FROM telemetry_events");

  let deleted = 0;
  // Một transaction cho toàn bộ prune — mỗi statement vẫn giới hạn ≤50k row.
  db.transaction(() => {
    while (true) {
      const changes = deleteAged.run(cutoff, DELETE_BATCH).changes;
      deleted += changes;
      if (changes < DELETE_BATCH) break;
    }
    let remaining = (countRows.get() as { n: number } | null)?.n ?? 0;
    while (remaining > maxRows) {
      const batch = Math.min(DELETE_BATCH, remaining - maxRows);
      const changes = deleteOldest.run(batch).changes;
      deleted += changes;
      remaining -= changes;
      if (changes === 0) break;
    }
  })();

  const remaining = (countRows.get() as { n: number } | null)?.n ?? 0;
  if (deleted > 0) log(`[telemetry] pruned ${deleted} rows`);
  return { deleted, remaining };
}

/** Prune ngay khi boot + mỗi giờ. Timer unref để không giữ process sống. */
export function startTelemetryRetention(opts: { intervalMs?: number } = {}): { stop: () => void } {
  const run = () => {
    try {
      pruneTelemetry();
    } catch (e) {
      console.error("[telemetry] prune failed", e);
    }
  };
  run();
  const timer = setInterval(run, opts.intervalMs ?? HOUR_MS);
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
