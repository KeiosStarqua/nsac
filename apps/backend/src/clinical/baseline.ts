// Baseline robust helpers — pure functions, unit-tested (tests/clinical-baseline.test.ts).
//
// Median/MAD robust outlier method:
//   Leys, C., Ley, C., Klein, O., Bernard, P. & Licata, L. (2013). "Detecting outliers:
//   Do not use standard deviation around the mean, use absolute deviation around the median."
//   Journal of Experimental Social Psychology, 49(4), 764–766.
//   https://doi.org/10.1016/j.jesp.2013.03.013
//   (Lưu ý: prompt task ghi DOI Journal of Neuroscience Methods — DOI đó resolve sang một
//   bài proteomics khác; DOI đúng của Leys et al. 2013 là jesp.2013.03.013. Verified 2026-11-16.)
// MAD được scale 1.4826 để consistent estimator của σ với phân phối chuẩn.
// Các hằng số cardio-v1 là ENGINEERING DEMO TUNING — KHÔNG phải clinical guidance.

export const MAD_TO_SIGMA = 1.4826;
export const EWMA_ALPHA = 0.3;

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of empty array");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median Absolute Deviation around the median (Leys et al. 2013). */
export function mad(values: number[]): number {
  if (values.length === 0) throw new Error("mad of empty array");
  const med = median(values);
  return median(values.map((v) => Math.abs(v - med)));
}

export interface RobustZResult {
  /** z per input sample (same order). */
  z: number[];
  median: number;
  mad: number;
  /** Which estimator produced z. */
  method: "mad" | "ewma-residual" | "degenerate";
}

/** EWMA series (α = 0.3). seed = first value. */
export function ewma(values: number[], alpha: number = EWMA_ALPHA): number[] {
  if (values.length === 0) return [];
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(alpha * values[i] + (1 - alpha) * out[i - 1]);
  }
  return out;
}

/**
 * Robust z cho từng sample. Nếu MAD == 0 → fallback sang residual EWMA (α=0.3) so với
 * median absolute deviation của chính residuals. Nếu cả hai đều 0 → method "degenerate"
 * và z = NaN cho mọi sample (detector phải trả "unknown", KHÔNG green).
 */
export function robustZScores(values: number[]): RobustZResult {
  if (values.length === 0) {
    return { z: [], median: NaN, mad: NaN, method: "degenerate" };
  }
  const med = median(values);
  const m = mad(values);
  if (m > 0) {
    return {
      z: values.map((v) => (v - med) / (MAD_TO_SIGMA * m)),
      median: med,
      mad: m,
      method: "mad",
    };
  }
  // Fallback: residual EWMA (α=0.3) so với MEAN absolute deviation của chính residuals.
  // Residuals EWMA về bản chất có mean ≈ 0 nên MAD-around-median = 0 cho constant+jump;
  // mean|r| > 0 vẫn bắt được. Scale ≈ σ × √(2/π) nên σ̂ = mean|r| × √(π/2).
  const series = ewma(values);
  const residuals = values.map((v, i) => v - series[i]);
  const meanAbsResid = residuals.reduce((a, r) => a + Math.abs(r), 0) / residuals.length;
  if (meanAbsResid > 0) {
    const SIGMA_FROM_MEAN_ABS = Math.sqrt(Math.PI / 2);
    const scale = SIGMA_FROM_MEAN_ABS * meanAbsResid;
    return {
      z: residuals.map((r) => r / scale),
      median: med,
      mad: 0,
      method: "ewma-residual",
    };
  }
  return { z: values.map(() => NaN), median: med, mad: 0, method: "degenerate" };
}

/**
 * Trend slope (units/min) over the last `window` samples: least-squares slope của chuỗi
 * EWMA (α=0.3) theo thời gian. `observedAtMs` phải cùng độ dài với values, đơn vị ms.
 * Trả 0 khi window < 2 điểm hoặc toàn bộ cùng thời điểm.
 */
export function ewmaSlopePerMinute(
  values: number[],
  observedAtMs: number[],
  window = 20,
  alpha: number = EWMA_ALPHA,
): number {
  if (values.length !== observedAtMs.length) {
    throw new Error("values and observedAtMs length mismatch");
  }
  const n = Math.min(window, values.length);
  if (n < 2) return 0;
  const v = values.slice(-n);
  const t = observedAtMs.slice(-n);
  const series = ewma(v, alpha);
  const t0 = t[0];
  const minutes = t.map((ms) => (ms - t0) / 60_000);
  const meanT = minutes.reduce((a, b) => a + b, 0) / n;
  const meanY = series.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (minutes[i] - meanT) * (series[i] - meanY);
    den += (minutes[i] - meanT) ** 2;
  }
  if (den === 0) return 0;
  return num / den;
}
