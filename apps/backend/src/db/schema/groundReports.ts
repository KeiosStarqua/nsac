import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const groundReports = sqliteTable("ground_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionDay: integer("mission_day").notNull(),
  summary: text("summary").notNull(),
  deviations: text("deviations").notNull(),
  actionsTaken: text("actions_taken").notNull(),
  queuedAt: text("queued_at").notNull(),
  deliverAt: text("deliver_at").notNull(),
});