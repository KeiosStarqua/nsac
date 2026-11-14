import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const recommendations = sqliteTable("recommendations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  dose: text("dose"),
  checklistRefDoc: text("checklist_ref_doc"),
  checklistRefPage: integer("checklist_ref_page"),
  rationale: text("rationale").notNull(),
  requiresConfirmation: integer("requires_confirmation", { mode: "boolean" }).notNull().default(true),
});