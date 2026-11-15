import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Live health projection (SPEC §14 v2, PR2). KHÔNG thay `health_observations`: bảng đó là seed
// 35 ngày (lịch sử) và không bao giờ được coi là measurement live.
//
// `health_current` = giá trị mới nhất theo (astronaut, metric) — UPSERT mỗi frame telemetry.
// `health_rollups` = aggregate 1 phút (ghi) / 1 giờ (tính on-the-fly từ 1m, không lưu).
// scope = astronaut id hoặc sentinel "MISSION" cho metric cabin (env).
export const healthCurrent = sqliteTable(
  "health_current",
  {
    astronautId: text("astronaut_id").notNull(),
    metric: text("metric").notNull(),
    value: real("value").notNull(),
    unit: text("unit").notNull(),
    quality: text("quality").notNull(),
    /** Nguồn dữ liệu — v2 chỉ `sim`. */
    source: text("source").notNull(),
    /** observed_at của sim (UTC ISO-8601) — thời điểm đo. */
    measuredAt: text("measured_at").notNull(),
    /** Wall clock ms lúc ingest — dùng cho freshness ~10 s của /api/health/live. */
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.astronautId, table.metric] }) }),
);

export const healthRollups = sqliteTable(
  "health_rollups",
  {
    scope: text("scope").notNull(),
    metric: text("metric").notNull(),
    /** 1m | 1h */
    bucket: text("bucket").notNull(),
    /** Epoch ms bắt đầu bucket (đã floor). */
    bucketStart: integer("bucket_start").notNull(),
    valueMin: real("value_min").notNull(),
    valueMax: real("value_max").notNull(),
    valueAvg: real("value_avg").notNull(),
    valueCount: integer("value_count").notNull(),
    qualityWorst: text("quality_worst").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.scope, table.metric, table.bucket, table.bucketStart] }),
  }),
);
