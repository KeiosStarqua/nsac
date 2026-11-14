import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: text("ts").notNull(),
  event: text("event").notNull(),
  detail: text("detail"),
});