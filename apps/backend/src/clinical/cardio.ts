// Cardio detector — pure rule engine + runner đọc telemetry (HARNESSING §17).
//
// ⚠ ENGINEERING DEMO POLICY `cardio-v1` — KHÔNG PHẢI CLINICAL GUIDANCE, KHÔNG chẩn đoán,
// KHÔNG dùng cho quyết định y khoa thật. Severity đến từ rule engine này, không bao giờ
// từ model. NASA-STD-3001 Vol 1 active rev là Rev C (2023-09-15); clinical thresholds
// nằm ngoài scope — mọi con số dưới đây là demo tuning, mỗi số mang comment nguồn.
//
// Nguồn đối chiếu (method, không phải threshold):
//   Leys, Ley, Klein, Bernard & Licata (2013). Journal of Experimental Social Psychology,
//   49(4), 764–766. https://doi.org/10.1016/j.jesp.2013.03.013 (MAD outlier method)
// Nguồn bối cảnh KHÔNG phải threshold:
//   HRP Evidence Reports (space HR physiology) — https://humanresearchroadmap.nasa.gov/evidencereports/
//   (site trả lỗi/redirect khi truy cập tự động 2026-11-16; dùng như citation context)
//   Circulation 2026 ISS HR/LV-stroke volume — https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665
//   (403 với fetch tự động do bot-protection; citation context, không phải threshold)
//   Simulator tuning — apps/backend/src/sensors/metrics.ts (in-repo, ILLUSTRATIVE)
//
// thresholdSource trong evidence = Leys DOI (method); các ngưỡng 2.5/3.0/3.5/4.5 là
// engineering demo tuning, được ghi rõ trong comment từng hằng số bên dưới.

import { desc, eq } from "drizzle-orm";
import { sensorsDb } from "../db/sensorsClient";
import { telemetryEvents } from "../db/schema/telemetryEvents";
import { ewmaSlopePerMinute, robustZScores } from "./baseline";
import { assessHrQuality, type HrSample, type TelemetrySampleInput } from "./quality";
import type { ClinicalFindingEvidence, Severity } from "./types";

// --- cardio-v1 detection constants (ENGINEERING DEMO POLICY, NOT CLINICAL GUIDANCE) ---
// Sustained band: |z| ≥ YELLOW_Z sustained ≥ SUSTAINED_RUN consecutive samples → yellow.
// 2.5 = demo "review band" — loose hơn 3σ classical để demo bắt được drift; KHÔNG phải
// ngưỡng lâm sàng. Method: Leys et al. 2013 (https://doi.org/10.1016/j.jesp.2013.03.013).
export const CARDIO_V1_YELLOW_Z = 2.5;
// Sustained red band. 3.0 = demo "escalation band". Engineering tuning, NOT clinical.
export const CARDIO_V1_RED_Z = 3.0;
// Single-sample outlier → yellow. 3.5 = demo single-sample review band. NOT clinical.
export const CARDIO_V1_YELLOW_SINGLE_Z = 3.5;
// Single-sample outlier → red. 4.5 = demo single-sample escalation band. NOT clinical.
export const CARDIO_V1_RED_SINGLE_Z = 4.5;
// Số sample liên tiếp |z| ≥ YELLOW_Z / RED_Z để tính "sustained". 5 = demo window
// (≈5 phút với cadence 1 Hz throttled hoặc 5 phút timer). NOT clinical.
export const CARDIO_V1_SUSTAINED_RUN = 5;
// Detection window: phân tích tối đa 240 points gần nhất.
export const CARDIO_V1_WINDOW = 240;

export const CARDIO_V1_THRESHOLD_SOURCE =
  "https://doi.org/10.1016/j.jesp.2013.03.013"; // Leys et al. 2013 — MAD method; values are engineering demo tuning, NOT clinical guidance

export interface CardioDetection {
  severity: Severity;
  /** NaN entries when baseline degenerate. */
  zScores: number[];
  baselineMedian: number | null;
  baselineMad: number | null;
  estimator: "mad" | "ewma-residual" | "degenerate";
  /** Length of the trailing run with |z| ≥ CARDIO_V1_YELLOW_Z. */
  trailingRun: number;
  /** EWMA trend slope over the last 20 samples, bpm/min. */
  slopeBpmPerMin: number | null;
  methodNote: string;
}

function trailingRunLength(z: number[], threshold: number): number {
  let run = 0;
  for (let i = z.length - 1; i >= 0; i--) {
    if (Number.isFinite(z[i]) && Math.abs(z[i]) >= threshold) run += 1;
    else break;
  }
  return run;
}

/** Detector thuần — không IO. Input: samples đã qua quality gate (valid only), oldest → newest. */
export function detectCardio(samples: HrSample[]): CardioDetection {
  const values = samples.map((s) => s.value);
  const times = samples.map((s) => s.observedAtMs);
  const baseline = robustZScores(values);
  const slope = ewmaSlopePerMinute(values, times, 20);

  if (baseline.method === "degenerate") {
    // Không ước lượng được baseline — "unknown", KHÔNG green. Silence is not safety.
    return {
      severity: "unknown",
      zScores: baseline.z,
      baselineMedian: baseline.median,
      baselineMad: 0,
      estimator: "degenerate",
      trailingRun: 0,
      slopeBpmPerMin: slope,
      methodNote: "Baseline degenerate (MAD và EWMA-residual MAD đều 0) — không kết luận được, KHÔNG phải green.",
    };
  }

  const absZ = baseline.z.map((z) => Math.abs(z));
  const singleMax = Math.max(...absZ);
  const runRed = trailingRunLength(baseline.z, CARDIO_V1_RED_Z);
  const runYellow = trailingRunLength(baseline.z, CARDIO_V1_YELLOW_Z);

  let severity: Severity = "green";
  if (runRed >= CARDIO_V1_SUSTAINED_RUN || singleMax >= CARDIO_V1_RED_SINGLE_Z) {
    severity = "red";
  } else if (runYellow >= CARDIO_V1_SUSTAINED_RUN || singleMax >= CARDIO_V1_YELLOW_SINGLE_Z) {
    severity = "yellow";
  }

  return {
    severity,
    zScores: baseline.z,
    baselineMedian: baseline.median,
    baselineMad: baseline.mad,
    estimator: baseline.method,
    trailingRun: runYellow,
    slopeBpmPerMin: slope,
    methodNote:
      baseline.method === "mad"
        ? "median/MAD z (Leys et al. 2013)"
        : "MAD==0 → fallback EWMA-residual z (Leys et al. 2013 applied to EWMA residuals)",
  };
}

export interface CardioRunResult {
  status: "ok" | "skipped_quality";
  severity?: Severity;
  findingId?: string;
  detail?: string;
}

const MAX_TELEMETRY_ROWS = 500; // ứng viên rows để lọc HR (payload JSON)
const MAX_SAMPLES = CARDIO_V1_WINDOW; // 240

/** Đọc HR samples gần nhất cho một astronaut (payload parse ở quality gate). */
export function readHrSamples(astronautId: string, cap: number = MAX_SAMPLES): TelemetrySampleInput[] {
  const rows = sensorsDb
    .select({
      eventId: telemetryEvents.eventId,
      observedAt: telemetryEvents.observedAt,
      qualityStatus: telemetryEvents.qualityStatus,
      payload: telemetryEvents.payload,
    })
    .from(telemetryEvents)
    .where(eq(telemetryEvents.crewId, astronautId))
    .orderBy(desc(telemetryEvents.observedAt))
    .limit(MAX_TELEMETRY_ROWS)
    .all();
  // Filter rows actually carrying a numeric heart_rate_bpm, newest-first, then cap.
  const withHr: TelemetrySampleInput[] = [];
  for (const r of rows) {
    try {
      const payload = JSON.parse(r.payload) as Record<string, unknown> | null;
      if (payload && payload.heart_rate_bpm !== undefined && payload.heart_rate_bpm !== null) {
        withHr.push(r);
      }
    } catch {
      // bad payload — skip (quality gate sẽ không thấy row này)
    }
    if (withHr.length >= cap) break;
  }
  return withHr;
}

/**
 * Runner: quality gate → detectCardio. KHÔNG persist finding — việc đó ở findings.ts
 * (cooldown + insert + publish). Trả detection + samples để caller quyết định.
 * Khi gate fail: status "skipped_quality", không detector nào chạy.
 */
export function analyzeAstronautCardio(astronautId: string, now: Date = new Date()): {
  quality: ReturnType<typeof assessHrQuality>;
  detection?: CardioDetection;
  validSamples: HrSample[];
} {
  const rows = readHrSamples(astronautId);
  const quality = assessHrQuality(rows, now);
  if (!quality.ok) {
    return { quality, validSamples: [] };
  }
  const validSamples = quality.samples.filter((s) => s.quality === "valid").slice(-MAX_SAMPLES);
  const detection = detectCardio(validSamples);
  return { quality, detection, validSamples };
}

/** Evidence builder — dataKind luôn "simulated" cho V1 telemetry sim. */
export function buildCardioEvidence(
  validSamples: HrSample[],
  detection: CardioDetection,
  quality: "valid" | "degraded" | "missing",
): ClinicalFindingEvidence {
  const first = validSamples[0]?.eventId ?? "unknown";
  const last = validSamples[validSamples.length - 1]?.eventId ?? "unknown";
  return {
    sourceIds: [`telemetry:${first}..${last}`],
    dataKind: "simulated",
    modelVersion: "cardio-v1",
    thresholdSource: `${CARDIO_V1_THRESHOLD_SOURCE} (method DOI; threshold values are engineering demo tuning, NOT clinical guidance)`,
    quality,
  };
}

/** Summary plain-language — không chẩn đoán, không số liệu bịa, có chữ "simulated". */
export function cardioSummary(severity: Severity): string {
  const base =
    "Heart-rate readings deviated from this astronaut's recent baseline (robust deviation beyond the cardio-v1 demo review band) in simulated telemetry.";
  switch (severity) {
    case "red":
      return `${base} Severity: RED (engineering demo band) — human review requested. Simulated data, not a medical diagnosis.`;
    case "yellow":
      return `${base} Severity: yellow (engineering demo band) — human review requested. Simulated data, not a medical diagnosis.`;
    case "unknown":
      return "Heart-rate baseline could not be estimated from the simulated telemetry window (degenerate spread). Inconclusive — not green; human review requested. Simulated data, not a medical diagnosis.";
    default:
      return `${base}`;
  }
}
