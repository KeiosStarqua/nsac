import { z } from "zod";

// Clinical contract types — MedicalAgentDefinition + RoutineDefinition (HARNESSING §17).
// Deterministic engine; NO LLM anywhere in this module. Severity đến từ rule engine,
// không bao giờ từ model. Mọi ngưỡng trong cardio-v1 là ENGINEERING DEMO POLICY —
// KHÔNG phải clinical guidance (xem cardio.ts).

export const SEVERITIES = ["green", "yellow", "red", "unknown"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DATA_KINDS = ["measured", "predicted", "simulated", "analog-study"] as const;
export type DataKind = (typeof DATA_KINDS)[number];

export const FINDING_STATUSES = ["new", "reviewed", "resolved"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const ROUTINE_RUN_STATUSES = ["running", "ok", "skipped_quality", "cooldown", "failed"] as const;
export type RoutineRunStatus = (typeof ROUTINE_RUN_STATUSES)[number];

export type RoutineDefinition =
  // RESERVED in V1: không có telemetry bus topic nào để trigger. `event` được để lại trong
  // union theo hợp đồng, KHÔNG implement — cardio được phục vụ bởi interval watermark và sẽ
  // subscribe telemetry/change_events khi WS path được wire (HARNESSING §17).
  | { kind: "event"; topic: string }
  | { kind: "interval"; everyMinutes: number }
  | { kind: "daily"; at: string /* "HH:MM" server-local */ }
  | { kind: "manual" };

export interface MedicalAgentDefinition {
  /** e.g. "sky-cardio". */
  id: string;
  /** e.g. "cardiovascular". */
  specialty: string;
  /** Telemetry metric ids this specialist consumes. */
  metrics: string[];
  /** "hr" — provenance link to the Sky ML task. NOT executed in this backend. */
  modelTask?: string;
  /** Policy id, e.g. "cardio-v1" — engineering demo policy, not clinical guidance. */
  policyId: string;
  routines: RoutineDefinition[];
  output: "clinical-finding";
}

/** ClinicalFinding.evidence — dataKind luôn "simulated" cho V1 telemetry. */
export const clinicalFindingEvidenceSchema = z
  .object({
    sourceIds: z.array(z.string().max(160)).max(16),
    dataKind: z.enum(DATA_KINDS),
    modelVersion: z.string().max(64).optional(),
    thresholdSource: z.string().max(512).optional(),
    quality: z.enum(["valid", "degraded", "missing"]),
  })
  .strict();
export type ClinicalFindingEvidence = z.infer<typeof clinicalFindingEvidenceSchema>;

/** Một finding đúng dạng API (camelCase). */
export interface ClinicalFinding {
  id: string;
  astronautId: string;
  specialistId: string;
  observedAt: string;
  metricIds: string[];
  severity: Severity;
  status: FindingStatus;
  summary: string;
  evidence: ClinicalFindingEvidence;
  requiresMedicalReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export const SEVERITY_RANK: Record<Severity, number> = {
  green: 0,
  unknown: 1,
  yellow: 2,
  red: 3,
};
