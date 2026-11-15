// Contract + tolerant parsing for the backend's `/api/clinical/*` routes.
//
// Wire format (camelCase):
//   { id, astronautId, specialistId, observedAt (ISO), metricIds[], severity, status, summary,
//     evidence: { sourceIds[], dataKind, modelVersion?, thresholdSource?, quality },
//     requiresMedicalReview, createdAt, updatedAt }
//
// This is a wire mirror of the backend — no code is shared between the two deployables.
// Unknown extra fields are stripped (zod default); a row that fails validation is dropped,
// never "repaired". Nothing here touches React, the DOM or the network.
import { z } from "zod";

export const CLINICAL_SEVERITIES = ["green", "yellow", "red", "unknown"] as const;
export type ClinicalSeverity = (typeof CLINICAL_SEVERITIES)[number];

export const CLINICAL_STATUSES = ["new", "reviewed", "resolved"] as const;
export type ClinicalStatus = (typeof CLINICAL_STATUSES)[number];

export const CLINICAL_DATA_KINDS = ["measured", "predicted", "simulated", "analog-study"] as const;
export type ClinicalDataKind = (typeof CLINICAL_DATA_KINDS)[number];

export const CLINICAL_QUALITIES = ["valid", "degraded", "missing"] as const;
export type ClinicalQuality = (typeof CLINICAL_QUALITIES)[number];

export const clinicalEvidenceSchema = z.object({
  sourceIds: z.array(z.string().max(200)).max(50).default([]),
  dataKind: z.enum(CLINICAL_DATA_KINDS).catch("simulated"),
  modelVersion: z.string().max(120).optional(),
  thresholdSource: z.string().max(500).optional(),
  quality: z.enum(CLINICAL_QUALITIES).catch("valid"),
});
export type ClinicalEvidence = z.infer<typeof clinicalEvidenceSchema>;

export const clinicalFindingSchema = z.object({
  id: z.string().trim().min(1).max(64),
  astronautId: z.string().trim().min(1).max(128),
  specialistId: z.string().trim().min(1).max(128),
  observedAt: z.string().trim().min(1).max(40),
  metricIds: z.array(z.string().max(120)).max(50).default([]),
  severity: z.enum(CLINICAL_SEVERITIES).catch("unknown"),
  status: z.enum(CLINICAL_STATUSES).catch("new"),
  summary: z.string().trim().max(2000).default(""),
  evidence: clinicalEvidenceSchema.catch({ sourceIds: [], dataKind: "simulated", quality: "valid" }),
  requiresMedicalReview: z.boolean().catch(false),
  createdAt: z.string().max(40).optional(),
  updatedAt: z.string().max(40).optional(),
});
export type ClinicalFinding = z.infer<typeof clinicalFindingSchema>;

const findingsResponseSchema = z.object({
  ok: z.literal(true),
  findings: z.array(z.unknown()),
});

/**
 * Parse `GET /api/clinical/findings` into findings. Returns null when the envelope is wrong
 * (backend down / contract drift); otherwise drops rows that fail validation and keeps the rest,
 * never throwing.
 */
export function parseFindingsResponse(body: unknown): ClinicalFinding[] | null {
  const envelope = findingsResponseSchema.safeParse(body);
  if (!envelope.success) return null;
  const findings: ClinicalFinding[] = [];
  for (const raw of envelope.data.findings) {
    const row = clinicalFindingSchema.safeParse(raw);
    if (row.success) findings.push(row.data);
  }
  return findings;
}

const findingResponseSchema = z.object({
  ok: z.literal(true),
  finding: z.unknown(),
});

/** Parse `POST /api/clinical/findings/:id/review` into a finding, or null. */
export function parseFindingResponse(body: unknown): ClinicalFinding | null {
  const envelope = findingResponseSchema.safeParse(body);
  if (!envelope.success) return null;
  const row = clinicalFindingSchema.safeParse(envelope.data.finding);
  return row.success ? row.data : null;
}

/** Findings still open for the crew member — resolved rows are dropped, newest first is kept. */
export function openFindings(findings: readonly ClinicalFinding[], limit = 20): ClinicalFinding[] {
  return findings.filter((f) => f.status !== "resolved").slice(0, limit);
}
