import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Bảng key-value cho cài đặt runtime (vd. `agent.model`). Không có lịch sử migration;
// client.ts tạo idempotent ở startup (ensureSchema) giống astronaut_claims.
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  /** Giá trị tuỳ theo `key`; với agent.model là model id OpenRouter. */
  value: text("value").notNull(),
  /** Unix ms. */
  updatedAt: integer("updated_at").notNull(),
});
