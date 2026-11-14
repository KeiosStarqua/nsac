import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const deviations = sqliteTable("deviations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  metric: text("metric").notNull(),
  value: real("value").notNull(),
  baselineMedian: real("baseline_median").notNull(),
  baselineMad: real("baseline_mad").notNull(),
  z: real("z").notNull(),
  slope: real("slope").notNull(),
  severity: text("severity").notNull(),
  thresholdSourceUrl: text("threshold_source_url").notNull(),
});