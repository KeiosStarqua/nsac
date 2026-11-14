import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const astronauts = sqliteTable("astronauts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  roleCode: text("role_code").notNull(),
  callsign: text("callsign"),
  bio: text("bio"),
});