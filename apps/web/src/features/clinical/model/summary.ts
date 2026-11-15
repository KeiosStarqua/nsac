// Output gate for the `sky-medical-officer` one-shot synthesis.
//
// The officer SUMMARIZES already-validated findings; it never decides severity, never acts,
// never plays physician. This module is the pure, network-free part of the gate:
//   - parseClinicalCaseSummary — strip fences → JSON.parse → validate → repair to the contract
//   - deterministicClinicalSummary — the no-model fallback (badge says so in the UI)
//   - effectiveRequiresMedicalReview — belt and braces over both paths: the flag is true when
//     the model says so OR any input finding requires review OR is red. The model can never
//     clear a review flag that the data raised.
// Nothing here touches React, the DOM or the network.
import { z } from "zod";
import { CLINICAL_DISCLAIMER } from "./constants";
import { CLINICAL_SEVERITIES, type ClinicalFinding, type ClinicalSeverity } from "./findings";

export { CLINICAL_DISCLAIMER, CLINICAL_DISCLAIMER_VI } from "./constants";

export type ClinicalCaseKeyFinding = {
  readonly specialistId: string;
  readonly severity: ClinicalSeverity;
  /** ≤140 chars. */
  readonly oneLine: string;
};

export type ClinicalCaseSummary = {
  readonly summary: string;
  readonly keyFindings: readonly ClinicalCaseKeyFinding[];
  readonly requiresMedicalReview: boolean;
  /** Always the exact constant — the model's value is never trusted for this field. */
  readonly disclaimer: string;
};

const MAX_SUMMARY = 600;
const MAX_ONE_LINE = 140;
const MAX_KEY_FINDINGS = 5;

function stripFences(raw: string): string {
  let text = raw.trim();
  // ```json … ``` or ``` … ```
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fenced?.[1]) return fenced[1].trim();
  // Leading fence without a closing one
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return text;
}

function parseJsonLoose(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    // Salvage the outermost object if the model added prose around it (zod still validates).
    const match = /\{[\s\S]*\}/.exec(text);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

const keyFindingSchema = z.object({
  specialistId: z.string().trim().min(1).max(64),
  severity: z.enum(CLINICAL_SEVERITIES),
  oneLine: z.string().trim().min(1).max(400),
});

const caseSummarySchema = z.object({
  summary: z.string().trim().min(1),
  keyFindings: z.array(z.unknown()).max(50).default([]),
  requiresMedicalReview: z.boolean(),
  disclaimer: z.unknown().optional(),
});

/**
 * Validate the officer's raw output against the contract. Returns null when the shape is wrong
 * (caller falls back to the deterministic summary). Tolerations, all deliberate:
 *   - ``` fences stripped; one salvage pass for stray prose around the object
 *   - summary longer than 600 chars is truncated, not rejected
 *   - keyFindings rows with a severity outside the enum are dropped (summary kept)
 *   - keyFindings capped at 5, strings trimmed, oneLine truncated to 140
 *   - disclaimer is forced to the exact constant regardless of what the model wrote
 *   - requiresMedicalReview must be a real boolean — missing/non-boolean is a shape failure
 */
export function parseClinicalCaseSummary(raw: string): ClinicalCaseSummary | null {
  if (typeof raw !== "string") return null;
  const json = parseJsonLoose(stripFences(raw));
  if (json === null) return null;
  const parsed = caseSummarySchema.safeParse(json);
  if (!parsed.success) return null;

  const summary =
    parsed.data.summary.length > MAX_SUMMARY
      ? parsed.data.summary.slice(0, MAX_SUMMARY)
      : parsed.data.summary;

  const keyFindings: ClinicalCaseKeyFinding[] = [];
  for (const row of parsed.data.keyFindings) {
    if (keyFindings.length >= MAX_KEY_FINDINGS) break;
    const kf = keyFindingSchema.safeParse(row);
    if (!kf.success) continue; // bad severity/specialist → drop entry, keep summary
    keyFindings.push({
      specialistId: kf.data.specialistId,
      severity: kf.data.severity,
      oneLine:
        kf.data.oneLine.length > MAX_ONE_LINE ? kf.data.oneLine.slice(0, MAX_ONE_LINE) : kf.data.oneLine,
    });
  }

  return {
    summary,
    keyFindings,
    requiresMedicalReview: parsed.data.requiresMedicalReview,
    disclaimer: CLINICAL_DISCLAIMER,
  };
}

/** True when any input finding demands a human medical review, or is red severity. */
export function anyFindingRequiresReview(findings: readonly ClinicalFinding[]): boolean {
  return findings.some((f) => f.requiresMedicalReview || f.severity === "red");
}

/** Belt and braces: the model can never clear a review flag the data raised. */
export function effectiveRequiresMedicalReview(
  modelValue: boolean,
  findings: readonly ClinicalFinding[],
): boolean {
  return modelValue || anyFindingRequiresReview(findings);
}

function firstSentence(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Deterministic one-shot summary — counts findings by severity, names red/yellow specialists,
 * tags the block as simulated telemetry. Used when the model key is missing, the model fails,
 * or the model output does not pass the gate. Pure and unit-tested.
 */
export function deterministicClinicalSummary(
  findings: readonly ClinicalFinding[],
  locale: "en" | "vi",
): ClinicalCaseSummary {
  const counts: Record<ClinicalSeverity, number> = { green: 0, yellow: 0, red: 0, unknown: 0 };
  for (const f of findings) counts[f.severity] += 1;

  const flagged = findings.filter((f) => f.severity === "red" || f.severity === "yellow");
  const flaggedNames = [...new Set(flagged.map((f) => f.specialistId.replace(/^sky-/, "")))];

  const total = findings.length;
  const summary =
    locale === "vi"
      ? firstSentence(
          `Tín hiệu từ telemetry mô phỏng: ${total} phát hiện đã xác thực — ${counts.red} đỏ, ${counts.yellow} vàng, ${counts.green} xanh, ${counts.unknown} không rõ.` +
            (flaggedNames.length > 0 ? ` Cần chú ý: ${flaggedNames.join(", ")}.` : "") +
            " Đây là dữ liệu mô phỏng; không thay thế đánh giá của bác sĩ.",
          MAX_SUMMARY,
        )
      : firstSentence(
          `Simulated telemetry: ${total} validated finding${total === 1 ? "" : "s"} — ${counts.red} red, ${counts.yellow} yellow, ${counts.green} green, ${counts.unknown} unknown.` +
            (flaggedNames.length > 0 ? ` Watch: ${flaggedNames.join(", ")}.` : "") +
            " This is simulated data, not a clinical assessment.",
          MAX_SUMMARY,
        );

  const keyFindings: ClinicalCaseKeyFinding[] = findings.slice(0, MAX_KEY_FINDINGS).map((f) => ({
    specialistId: f.specialistId,
    severity: f.severity,
    oneLine: firstSentence(f.summary || f.specialistId, MAX_ONE_LINE),
  }));

  return {
    summary,
    keyFindings,
    requiresMedicalReview: anyFindingRequiresReview(findings),
    disclaimer: CLINICAL_DISCLAIMER,
  };
}
