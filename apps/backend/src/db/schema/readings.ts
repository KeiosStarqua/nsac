import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const readings = sqliteTable("readings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  astronautId: text("astronaut_id").notNull(),
  ts: text("ts").notNull(),
  metric: text("metric").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  source: text("source").notNull(),
});