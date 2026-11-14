import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const readinessScores = sqliteTable("readiness_scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  score: real("score").notNull(),
  components: text("components").notNull(),
  ts: text("ts").notNull(),
});