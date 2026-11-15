// View model for the `/performance` live vitals strip. Pure: it turns one parsed payload into the
// ordered cards the strip renders, and nothing else.
//
// Only metrics present in the payload become cards (an absent key means "no data", never zero).
// Blood pressure is one card because the two numbers are only meaningful together; it renders
// whichever half the payload carries.
import type { LiveHealthPayload, LiveMetricId } from "./liveHealth";

/** The seven crew vitals the strip shows, in reading order. */
export const LIVE_STRIP_ORDER = [
  "heart_rate_bpm",
  "spo2_pct",
  "respiratory_rate_bpm",
  "core_temperature_c",
  "blood_pressure",
  "activity_counts",
] as const;

export type LiveStripCardId = (typeof LIVE_STRIP_ORDER)[number];

export interface LiveStripCard {
  readonly id: LiveStripCardId;
  readonly value: string;
  /** Unit from the payload (fixture units when the backend omits one). */
  readonly unit: string;
  /** Backend quality marker, forwarded verbatim as a data attribute. */
  readonly quality: string;
}

function formatMetric(id: LiveMetricId, value: number): string {
  // Core temperature is the only strip metric with a decimal in this demo; everything else is a
  // whole-number reading (bpm, %, breaths/min, mmHg, activity counts).
  return id === "core_temperature_c" ? value.toFixed(1) : String(Math.round(value));
}

/** Ordered cards for the payload's present metrics; `[]` when there is nothing to show. */
export function buildLiveStripCards(payload: LiveHealthPayload | null): LiveStripCard[] {
  if (!payload) return [];
  const { metrics } = payload;
  const cards: LiveStripCard[] = [];

  for (const id of LIVE_STRIP_ORDER) {
    if (id === "blood_pressure") {
      const systolic = metrics.systolic_mmhg;
      const diastolic = metrics.diastolic_mmhg;
      if (!systolic && !diastolic) continue;
      cards.push({
        id,
        value: `${systolic ? formatMetric("systolic_mmhg", systolic.value) : "—"}/${
          diastolic ? formatMetric("diastolic_mmhg", diastolic.value) : "—"
        }`,
        unit: systolic?.unit || diastolic?.unit || "mmHg",
        quality: systolic?.quality ?? diastolic?.quality ?? "unknown",
      });
      continue;
    }

    const metric = metrics[id];
    if (!metric) continue;
    cards.push({ id, value: formatMetric(id, metric.value), unit: metric.unit, quality: metric.quality });
  }

  return cards;
}
