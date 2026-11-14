// Deterministic display formatting & freshness — never fabricate a value, never call an LLM here.
import type { VitalReading, VitalVisualState } from "./types";

export function formatVital(reading: VitalReading): string {
  if (reading.value === null) return "—";
  switch (reading.kind) {
    case "heartRate": return `${Math.round(reading.value)} bpm`;
    case "respiration": return `${Math.round(reading.value)} br/min`;
    case "spo2": return `${Math.round(reading.value)} %`;
    case "sleep": {
      const hours = Math.floor(reading.value / 60);
      const minutes = Math.round(reading.value % 60);
      return `${hours} h ${minutes} m`;
    }
  }
}

export type Freshness = "current" | "stale" | "missing";
export function getReadingFreshness(reading: VitalReading, now: number, maxAgeMs: number): Freshness {
  if (reading.value === null || !reading.timestamp) return "missing";
  const age = now - Date.parse(reading.timestamp);
  return age <= maxAgeMs ? "current" : "stale";
}

/** Visual state is computed by explicit validated rules only; missing data is never "normal". */
export function getReadingVisualState(reading: VitalReading, zOverAdvisory: number): VitalVisualState {
  if (reading.value === null || !reading.timestamp) return "unknown";
  if (reading.quality === "unknown") return "unknown";
  if (reading.visualState) return reading.visualState;
  if (reading.baseline !== undefined && reading.mad !== undefined && reading.mad > 0) {
    const z = Math.abs((reading.value - reading.baseline) / reading.mad);
    if (z >= zOverAdvisory * 2) return "warning";
    if (z >= zOverAdvisory) return "advisory";
  }
  return "normal";
}

export const FRESHNESS_WINDOW_MS = 30 * 60 * 1000;

export function greetingFor(locale: "en" | "vi", localHour: number, displayName: string): string {
  const part = localHour < 5 ? "tonight" : localHour < 12 ? "morning" : localHour < 18 ? "afternoon" : "evening";
  if (locale === "vi") {
    const vi = part === "morning" ? "Buổi sáng" : part === "afternoon" ? "Buổi chiều" : part === "evening" ? "Buổi tối" : "Đêm nay";
    return `${vi}, ${displayName}.`;
  }
  return `Good ${part === "tonight" ? "evening" : part}, ${displayName}.`;
}
