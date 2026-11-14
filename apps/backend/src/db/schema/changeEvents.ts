import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Bảng broadcast local (§ AGENT_BROADCAST, v1): nguồn sự thật cho mọi shared event trên box này.
// astronaut_id NULL = fact toàn cục (mọi agent đều thấy); có giá trị = riêng tư cho một astronaut.
// payload là JSON đã validate theo topic ở eventsRoutes — đọc ra phải JSON.parse lại.
export const changeEvents = sqliteTable("change_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  astronautId: text("astronaut_id"),
  topic: text("topic").notNull(),
  source: text("source").notNull(),
  summary: text("summary"),
  payload: text("payload").notNull(),
  /** Unix ms. */
  createdAt: integer("created_at").notNull(),
});

export const consumerCursors = sqliteTable("consumer_cursors", {
  /** kebab-case, xem regex ở eventsRoutes (^[a-z0-9-]{3,64}$). */
  consumerId: text("consumer_id").primaryKey(),
  lastEventId: integer("last_event_id").notNull().default(0),
});
