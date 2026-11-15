import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// Clinical routine engine tables (HARNESSING §17). Clinical-owned connection:
// src/db/clinicalClient.ts (cùng file SKY_DB_PATH). Không có lịch sử migration;
// DDL trong ensureSchema của clinicalClient là nguồn sự thật.

export const clinicalFindings = sqliteTable(
  "clinical_findings",
  {
    id: text("id").primaryKey(),
    astronautId: text("astronaut_id").notNull(),
    specialistId: text("specialist_id").notNull(),
    observedAt: text("observed_at").notNull(),
    /** JSON array of metric ids, e.g. ["heart_rate_bpm"]. */
    metricIds: text("metric_ids").notNull(),
    severity: text("severity").notNull(),
    status: text("status").notNull().default("new"),
    summary: text("summary").notNull(),
    /** JSON object — see ClinicalFindingEvidence in src/clinical/types.ts. */
    evidence: text("evidence").notNull(),
    requiresMedicalReview: integer("requires_medical_review", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("clinical_findings_astronaut_status_created").on(t.astronautId, t.status, t.createdAt),
    index("clinical_findings_specialist_created").on(t.specialistId, t.createdAt),
  ],
);

export const routineRuns = sqliteTable(
  "routine_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    routineId: text("routine_id").notNull(),
    /** NULL for fleet-wide routines. */
    astronautId: text("astronaut_id"),
    bucket: text("bucket").notNull(),
    /** running | ok | skipped_quality | cooldown | failed */
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(1),
    detail: text("detail"),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
  },
  (t) => [
    uniqueIndex("routine_runs_routine_astronaut_bucket").on(t.routineId, t.astronautId, t.bucket),
  ],
);

export const clinicalAudit = sqliteTable("clinical_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  findingId: text("finding_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: integer("created_at").notNull(),
});

export const clinicalState = sqliteTable("clinical_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
