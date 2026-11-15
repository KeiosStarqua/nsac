import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { astronauts } from "./astronauts";

// Health observation layer (fitness/smartwatch-style metrics: energy, muscle, sleep, hydration).
// Toàn bộ giá trị là synthetic (HKT hard rule); method/quality mang độ tin của phép đo giả lập.
// CHECK constraint cho method/quality nằm ở DDL ensureSchema (client.ts) như telemetry_events —
// repo không có lịch sử migration nên DDL ở ensureSchema là nguồn sự thật duy nhất.
export const healthObservations = sqliteTable("health_observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** ISO-8601 UTC, precision ngày (00:00:00.000Z) trong seed hiện tại. */
  ts: text("ts").notNull(),
  astronautId: text("astronaut_id")
    .notNull()
    .references(() => astronauts.id, { onDelete: "cascade" }),
  metric: text("metric").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  /** Luôn "synthetic" ở seed hiện tại; giữ cột để phân biệt nguồn khi có dữ liệu thật. */
  source: text("source").notNull(),
  /** sensor | measured | estimated | self_reported | simulated — CHECK ở DDL. */
  method: text("method").notNull(),
  /** valid | suspect | invalid — CHECK ở DDL. */
  quality: text("quality").notNull(),
  /** 0..1, NULL khi không ước lượng được độ tin. */
  confidence: real("confidence"),
});
