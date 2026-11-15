// Findings service — create/list/get/review + audit + publish + cooldown (HARNESSING §17).
// Cooldown sống Ở ĐÂY: sau khi tạo finding yellow/red/unknown cho (astronaut, specialist)
// với severity S, suppress finding cùng severity trong CLINICAL_COOLDOWN_MINUTES (default 30);
// severity ESCALATION không bao giờ bị suppress. Suppressed → routine_runs ghi "cooldown",
// KHÔNG tạo audit row (nothing happened).

import { desc, eq, and, gte } from "drizzle-orm";
import { clinicalDb } from "../db/clinicalClient";
import { clinicalFindings, clinicalAudit } from "../db/schema/clinical";
import { safeJsonParse } from "./json";
import { publishClinicalEvent } from "./publish";
import { clinicalFindingEvidenceSchema, SEVERITY_RANK, type ClinicalFinding, type ClinicalFindingEvidence, type FindingStatus, type Severity } from "./types";

const COOLDOWN_MINUTES = Number(process.env.CLINICAL_COOLDOWN_MINUTES ?? 30);

function rowToFinding(row: typeof clinicalFindings.$inferSelect): ClinicalFinding {
  const evidenceJson = safeJsonParse(row.evidence);
  const evidence = clinicalFindingEvidenceSchema.parse(evidenceJson);
  return {
    id: row.id,
    astronautId: row.astronautId,
    specialistId: row.specialistId,
    observedAt: row.observedAt,
    metricIds: (safeJsonParse(row.metricIds) as string[]) ?? [],
    severity: row.severity as Severity,
    status: row.status as FindingStatus,
    summary: row.summary,
    evidence,
    requiresMedicalReview: row.requiresMedicalReview,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** Suppress chỉ khi có finding gần nhất trong cooldown window với rank ≥ rank(severity) mới. */
export function isInCooldown(astronautId: string, specialistId: string, severity: Severity): boolean {
  const since = Date.now() - (Number.isFinite(COOLDOWN_MINUTES) ? COOLDOWN_MINUTES : 30) * 60_000;
  const rows = clinicalDb
    .select({ severity: clinicalFindings.severity })
    .from(clinicalFindings)
    .where(
      and(
        eq(clinicalFindings.astronautId, astronautId),
        eq(clinicalFindings.specialistId, specialistId),
        gte(clinicalFindings.createdAt, since),
      ),
    )
    .orderBy(desc(clinicalFindings.createdAt))
    .limit(1)
    .all();
  const last = rows[0]?.severity as Severity | undefined;
  if (!last) return false;
  return SEVERITY_RANK[last] >= SEVERITY_RANK[severity];
}

export interface NewFindingInput {
  astronautId: string;
  specialistId: string;
  observedAt: string;
  metricIds: string[];
  severity: Severity;
  summary: string;
  evidence: ClinicalFindingEvidence;
}

export const findingsService = {
  /** Tạo finding + publish medical.finding.created. Publish fail KHÔNG rollback finding. */
  create(input: NewFindingInput): ClinicalFinding {
    const now = Date.now();
    const id = crypto.randomUUID();
    clinicalDb
      .insert(clinicalFindings)
      .values({
        id,
        astronautId: input.astronautId,
        specialistId: input.specialistId,
        observedAt: input.observedAt,
        metricIds: JSON.stringify(input.metricIds),
        severity: input.severity,
        status: "new",
        summary: input.summary,
        evidence: JSON.stringify(input.evidence),
        requiresMedicalReview: input.severity !== "green",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    try {
      publishClinicalEvent("medical.finding.created", input.astronautId, input.specialistId, input.summary.slice(0, 300), {
        findingId: id,
        specialistId: input.specialistId,
        severity: input.severity,
        requiresMedicalReview: input.severity !== "green",
      });
    } catch (err) {
      // Finding đã persist — publish fail chỉ log, không rollback.
      console.error("[clinical] publish medical.finding.created failed", err);
    }

    return this.get(id)!;
  },

  list({ astronautId, status, limit }: { astronautId?: string; status?: FindingStatus | "all"; limit: number }): ClinicalFinding[] {
    const conditions = [];
    if (astronautId) conditions.push(eq(clinicalFindings.astronautId, astronautId));
    if (status && status !== "all") conditions.push(eq(clinicalFindings.status, status));
    const query = clinicalDb.select().from(clinicalFindings);
    const filtered = conditions.length > 0 ? query.where(and(...conditions)) : query;
    const rows = filtered
      .orderBy(desc(clinicalFindings.createdAt), desc(clinicalFindings.id))
      .limit(limit)
      .all();
    return rows.map(rowToFinding);
  },

  get(id: string): ClinicalFinding | null {
    const row = clinicalDb.select().from(clinicalFindings).where(eq(clinicalFindings.id, id)).all()[0];
    return row ? rowToFinding(row) : null;
  },

  /** Review action: new→reviewed|resolved. Chỉ review + audit; KHÔNG có medical action. */
  review(id: string, action: "reviewed" | "resolved", note?: string): ClinicalFinding | null {
    const existing = clinicalDb.select().from(clinicalFindings).where(eq(clinicalFindings.id, id)).all()[0];
    if (!existing) return null;
    const now = Date.now();
    clinicalDb
      .update(clinicalFindings)
      .set({ status: action, updatedAt: now })
      .where(eq(clinicalFindings.id, id))
      .run();
    clinicalDb
      .insert(clinicalAudit)
      .values({ findingId: id, action, detail: note ? note.slice(0, 300) : null, createdAt: now })
      .run();

    if (action === "resolved") {
      try {
        publishClinicalEvent("medical.finding.resolved", existing.astronautId, existing.specialistId, `Finding resolved: ${id}`, {
          findingId: id,
          action: "resolved" as const,
        });
      } catch (err) {
        console.error("[clinical] publish medical.finding.resolved failed", err);
      }
    }
    return this.get(id);
  },
};
