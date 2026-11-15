// Pure view-model for the Clinical findings panel on `/performance`. No React, no IO —
// vitest covers this directly. Every row carries simulated-data labeling upstream; this layer
// only reshapes backend findings into renderable rows.
import type { ClinicalFinding, ClinicalSeverity, ClinicalDataKind } from "../../clinical/model/findings";

export type FindingTone = ClinicalSeverity;

export interface FindingRow {
  readonly id: string;
  readonly severity: ClinicalSeverity;
  readonly tone: FindingTone;
  /** specialistId minus a leading `sky-`, dashes → spaces, each word capitalized. */
  readonly specialist: string;
  readonly summary: string;
  readonly status: ClinicalFinding["status"];
  readonly dataKind: ClinicalDataKind;
  readonly dataKindChip: string;
  readonly quality: string;
  readonly requiresMedicalReview: boolean;
  /** https-only evidence link, else null. */
  readonly methodUrl: string | null;
  /** ISO string as given by the backend (rendering happens with the relative formatter). */
  readonly observedAt: string;
  readonly metricIds: readonly string[];
}

const DATA_KIND_CHIP: Record<ClinicalDataKind, string> = {
  simulated: "SIMULATED",
  "analog-study": "ANALOG-STUDY",
  measured: "MEASURED",
  predicted: "PREDICTED",
};

export function toneForSeverity(severity: ClinicalSeverity): FindingTone {
  return severity;
}

export function dataKindChip(kind: ClinicalDataKind): string {
  return DATA_KIND_CHIP[kind] ?? "SIMULATED";
}

export function specialistLabel(specialistId: string): string {
  const stripped = specialistId.replace(/^sky-/i, "").replace(/[-_]+/g, " ").trim();
  if (!stripped) return specialistId;
  return stripped
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const HTTPS_ONLY = /^https:\/\//i;

/** Only ever link https evidence thresholds; anything else renders as plain text. */
export function methodUrlOf(thresholdSource: string | undefined): string | null {
  if (!thresholdSource) return null;
  const trimmed = thresholdSource.trim();
  return HTTPS_ONLY.test(trimmed) ? trimmed : null;
}

export function toFindingRow(f: ClinicalFinding): FindingRow {
  return {
    id: f.id,
    severity: f.severity,
    tone: toneForSeverity(f.severity),
    specialist: specialistLabel(f.specialistId),
    summary: f.summary,
    status: f.status,
    dataKind: f.evidence.dataKind,
    dataKindChip: dataKindChip(f.evidence.dataKind),
    quality: f.evidence.quality,
    requiresMedicalReview: f.requiresMedicalReview,
    methodUrl: methodUrlOf(f.evidence.thresholdSource),
    observedAt: f.observedAt,
    metricIds: f.metricIds,
  };
}

const RELATIVE_DIVISIONS: ReadonlyArray<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/**
 * Relative observed-time via Intl.RelativeTimeFormat ("5 minutes ago" / "5 phút trước").
 * Invalid or unparseable timestamps return null — the row simply hides the time element.
 */
export function relativeObservedAt(
  iso: string,
  locale: "en" | "vi",
  now: number = Date.now(),
): string | null {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let duration = (ts - now) / 1000; // negative = past
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatter.format(Math.round(duration), "year");
}
