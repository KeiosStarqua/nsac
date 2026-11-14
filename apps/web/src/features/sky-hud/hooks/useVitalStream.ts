import { useMemo } from "react";
import { FRESHNESS_WINDOW_MS, formatVital, getReadingFreshness, getReadingVisualState } from "../domain";
import type { VitalKind, VitalReading } from "../domain";

export interface StreamedVital extends VitalReading {
  freshness: "current" | "stale" | "missing";
  display: string;
}

export function useVitalStream(
  vitals: Record<VitalKind, VitalReading>,
  now: number = Date.now(),
): StreamedVital[] {
  return useMemo(() => {
    return (Object.keys(vitals) as VitalKind[]).map((k) => {
      const r = vitals[k];
      const freshness = getReadingFreshness(r, now, FRESHNESS_WINDOW_MS);
      const visualState = getReadingVisualState(r, 2);
      const reading: VitalReading = { ...r, visualState };
      const display = formatVital(reading);
      return { ...reading, freshness, display };
    });
  }, [vitals, now]);
}