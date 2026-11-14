import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { astronauts } from "./astronauts";

export const astronautClaims = sqliteTable("astronaut_claims", {
  astronautId: text("astronaut_id")
    .primaryKey()
    .references(() => astronauts.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  /** Unix ms; set on claim and on every move/re-claim. */
  claimedAt: integer("claimed_at").notNull(),
});
