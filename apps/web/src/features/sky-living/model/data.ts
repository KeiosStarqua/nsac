// Simulated mission & medical data for the SKY demo. Every value is invented for storytelling and is
// labeled "Simulated data" in the UI; numbers never flow into free text (they ride measurementRef / Fact).
export const SIMULATED_LABEL = "Simulated data";
export const SIMULATED_CAVEAT = "Every measurement here is simulated for the demo. None of it is a real patient reading.";

export interface Measurement {
  readonly metric: string;
  readonly label: string;
  /** Unit-bearing string such as "62 bpm"; only ever rendered through controlled components. */
  readonly display: string;
  readonly value: number;
  readonly baseline: number;
  readonly mad: number;
  readonly unit: string;
  readonly trend: "stable" | "falling" | "rising";
  readonly quality: "good" | "limited" | "unknown";
  readonly source: string;
  readonly ts: string;
  readonly domain: string;
}

const now = Date.UTC(2026, 10, 12, 6, 0, 0);
const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();

export const MEASUREMENTS: readonly Measurement[] = [
  { metric: "hr-rest", label: "Resting heart rate", display: "62 bpm", value: 62, baseline: 58, mad: 3, unit: "bpm", trend: "rising", quality: "good", source: "arm cuff, morning", ts: ago(6), domain: "cardiovascular" },
  { metric: "hrv", label: "Heart-rate variability (rMSSD)", display: "32 ms", value: 32, baseline: 47, mad: 6, unit: "ms", trend: "falling", quality: "good", source: "chest patch", ts: ago(6), domain: "cardiovascular" },
  { metric: "spo2", label: "SpO₂", display: "97 %", value: 97, baseline: 97, mad: 1, unit: "%", trend: "stable", quality: "good", source: "pulse oximeter", ts: ago(9), domain: "respiratory" },
  { metric: "sleep-duration", label: "Sleep duration", display: "6.1 h", value: 6.1, baseline: 7.5, mad: 0.6, unit: "h", trend: "falling", quality: "good", source: "sleep pod", ts: ago(15), domain: "sleep" },
  { metric: "sleep-awakenings", label: "Night awakenings", display: "9", value: 9, baseline: 4, mad: 2, unit: "", trend: "rising", quality: "good", source: "sleep pod", ts: ago(15), domain: "sleep" },
  { metric: "exercise-adherence", label: "Exercise adherence (7 days)", display: "55 %", value: 55, baseline: 85, mad: 10, unit: "%", trend: "falling", quality: "good", source: "exercise equipment", ts: ago(11), domain: "exercise" },
  { metric: "musculoskeletal-leg", label: "Leg discomfort (0–10)", display: "6 of 10", value: 6, baseline: 2, mad: 1, unit: "/10", trend: "rising", quality: "limited", source: "crew check-in", ts: ago(11), domain: "musculoskeletal" },
  { metric: "radiation", label: "Radiation dose (this cycle)", display: "2.1 mGy", value: 2.1, baseline: 1.4, mad: 0.4, unit: "mGy", trend: "rising", quality: "good", source: "dosimeter", ts: ago(20), domain: "radiation" },
  { metric: "co2", label: "Cabin CO₂", display: "0.42 %", value: 0.42, baseline: 0.35, mad: 0.05, unit: "%", trend: "stable", quality: "good", source: "habitat sensors", ts: ago(2), domain: "environmental" },
  { metric: "exercise-hr-load", label: "Training load (week)", display: "3 of 4 sessions", value: 3, baseline: 4, mad: 1, unit: "sessions", trend: "stable", quality: "good", source: "exercise equipment", ts: ago(11), domain: "exercise" },
] as const;

export function measurement(metric: string): Measurement | undefined {
  return MEASUREMENTS.find((m) => m.metric === metric);
}

export function zScore(m: Measurement): number {
  return (m.value - m.baseline) / m.mad;
}
