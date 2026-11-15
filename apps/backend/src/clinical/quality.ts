// Quality gate cho HR samples — chạy TRƯỚC detection. Deterministic, không IO ngoài input.
//
// 30–220 bpm là technical sensor-range validation theo tasks.yaml `valid_hr_range`
// (Sky ML, nsac-data submodule — KHÔNG phải ngưỡng lâm sàng, KHÔNG phải clinical guidance).
// Mapping quality_status của telemetry: good → valid, suspect → degraded, invalid → missing.

export const HR_TECHNICAL_MIN_BPM = 30;
export const HR_TECHNICAL_MAX_BPM = 220;

export const MIN_VALID_SAMPLES = 12;
export const MAX_DEGRADED_FRACTION = 0.3;
export const STALE_AFTER_MS = 10 * 60 * 1000;

export type SampleQuality = "valid" | "degraded" | "missing";

export interface TelemetrySampleInput {
  /** Raw telemetry row fields the gate needs. */
  eventId: string;
  observedAt: string;
  qualityStatus: string;
  /** Raw payload JSON string (parse failures are skipped). */
  payload: string;
}

export interface HrSample {
  value: number;
  observedAt: string;
  observedAtMs: number;
  quality: SampleQuality;
  eventId: string;
}

export type QualityGateFailure = "too_few_samples" | "too_many_degraded" | "stale";

export interface QualityGateResult {
  ok: boolean;
  reason?: QualityGateFailure;
  /** Samples accepted for analysis (payload parsed, in range), oldest → newest. */
  samples: HrSample[];
  validCount: number;
  degradedOrMissingCount: number;
  /** Total parsed samples considered (valid + degraded + missing). */
  totalConsidered: number;
  newestValidAt: string | null;
  newestValidAtMs: number | null;
}

function mapQualityStatus(raw: string): SampleQuality {
  if (raw === "good") return "valid";
  if (raw === "suspect") return "degraded";
  return "missing"; // 'invalid' và mọi giá trị lạ → missing (không tin được)
}

/** Parse một row thành HrSample; trả null khi payload hỏng hoặc giá trị ngoài range kỹ thuật. */
export function parseHrSample(row: TelemetrySampleInput): HrSample | null {
  let value: unknown;
  try {
    const payload = JSON.parse(row.payload) as Record<string, unknown> | null;
    value = payload?.heart_rate_bpm;
  } catch {
    return null;
  }
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  if (n < HR_TECHNICAL_MIN_BPM || n > HR_TECHNICAL_MAX_BPM) return null; // technical range, NOT clinical
  const observedAtMs = Date.parse(row.observedAt);
  if (!Number.isFinite(observedAtMs)) return null;
  return {
    value: n,
    observedAt: row.observedAt,
    observedAtMs,
    quality: mapQualityStatus(row.qualityStatus),
    eventId: row.eventId,
  };
}

/** Quality gate thuần — test được không cần DB. `now` injectable cho tests. */
export function assessHrQuality(rows: TelemetrySampleInput[], now: Date = new Date()): QualityGateResult {
  const parsed = rows
    .map(parseHrSample)
    .filter((s): s is HrSample => s !== null)
    .sort((a, b) => a.observedAtMs - b.observedAtMs);

  const valid = parsed.filter((s) => s.quality === "valid");
  const degradedOrMissing = parsed.length - valid.length;

  const base = {
    samples: parsed,
    validCount: valid.length,
    degradedOrMissingCount: degradedOrMissing,
    totalConsidered: parsed.length,
    newestValidAt: valid.length ? valid[valid.length - 1].observedAt : null,
    newestValidAtMs: valid.length ? valid[valid.length - 1].observedAtMs : null,
  };

  if (valid.length < MIN_VALID_SAMPLES) {
    return { ...base, ok: false, reason: "too_few_samples" };
  }
  if (parsed.length > 0 && degradedOrMissing / parsed.length > MAX_DEGRADED_FRACTION) {
    return { ...base, ok: false, reason: "too_many_degraded" };
  }
  const newestMs = base.newestValidAtMs;
  if (newestMs === null || now.getTime() - newestMs > STALE_AFTER_MS) {
    return { ...base, ok: false, reason: "stale" };
  }
  return { ...base, ok: true };
}
