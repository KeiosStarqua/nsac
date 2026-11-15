// Contract + presentation model for the live health feed (`GET /api/health/live/:astronautId`).
//
// The backend publishes a small, flat snapshot of the simulated habitat/crew telemetry stream.
// Everything here is synthetic: `live: true` only means the simulation is running and the reading
// is fresh, never that a real sensor measured a real person. Nothing in this module touches React,
// the DOM or the network, so vitest covers it directly.
import { z } from "zod";

/** Metric keys the backend may publish. Absent keys mean "no data" — never zero. */
export const LIVE_METRIC_IDS = [
  "heart_rate_bpm",
  "spo2_pct",
  "respiratory_rate_bpm",
  "core_temperature_c",
  "skin_temperature_c",
  "systolic_mmhg",
  "diastolic_mmhg",
  "activity_counts",
  "dose_rate_uSv_h",
  "co2_ppm",
  "o2_pct",
  "power_w",
  "cadence_rpm",
  "elapsed_s",
] as const;

export type LiveMetricId = (typeof LIVE_METRIC_IDS)[number];

/** Units stay English, exactly as the rest of the simulated fleet data does (both locales). */
export const LIVE_METRIC_UNITS: Readonly<Record<LiveMetricId, string>> = {
  heart_rate_bpm: "bpm",
  spo2_pct: "%",
  respiratory_rate_bpm: "br/min",
  core_temperature_c: "°C",
  skin_temperature_c: "°C",
  systolic_mmhg: "mmHg",
  diastolic_mmhg: "mmHg",
  activity_counts: "cts",
  dose_rate_uSv_h: "µSv/h",
  co2_ppm: "ppm",
  o2_pct: "%",
  power_w: "W",
  cadence_rpm: "rpm",
  elapsed_s: "s",
};

export type LiveSource = "sim" | "seed" | "none";

export interface LiveMetric {
  readonly value: number;
  readonly unit: string;
  readonly quality: string;
}

export interface LiveHealthPayload {
  readonly ok: true;
  readonly live: boolean;
  readonly updatedAt: string | null;
  readonly source: LiveSource;
  readonly metrics: Readonly<Partial<Record<LiveMetricId, LiveMetric>>>;
}

/** What `useLiveHealth` exposes — the last good payload plus how it should be labelled. */
export interface LiveHealthState {
  /** Last good payload; `null` until one arrived (or when none ever did). */
  readonly data: LiveHealthPayload | null;
  /** `data.live` — the simulation is running and the reading is fresh. */
  readonly live: boolean;
  readonly source: LiveSource;
  readonly updatedAt: string | null;
  /** The first attempt finished (ok or failed): the UI may stop hiding the strip. */
  readonly settled: boolean;
  /** The last poll failed; `data` still holds the last good payload. */
  readonly stale: boolean;
}

export const LIVE_HEALTH_INITIAL: LiveHealthState = {
  data: null,
  live: false,
  source: "none",
  updatedAt: null,
  settled: false,
  stale: false,
};

const MetricSchema = z.object({
  value: z.number().finite(),
  unit: z.string().trim().optional().default(""),
  quality: z.string().trim().optional().default("unknown"),
});

const PayloadSchema = z.object({
  ok: z.literal(true).catch(true),
  live: z.boolean().catch(false),
  updatedAt: z.string().trim().nullish(),
  source: z.enum(["sim", "seed", "none"]).catch("none"),
  metrics: z.record(z.string(), z.unknown()).optional().default({}),
});

function isLiveMetricId(key: string): key is LiveMetricId {
  return (LIVE_METRIC_IDS as readonly string[]).includes(key);
}

/**
 * Parse one `/api/health/live/:id` body. `null` when the envelope is not an object — the caller
 * then keeps whatever it had, exactly like an unreachable backend. Unknown metric keys are
 * dropped, a known key with a malformed row is dropped on its own (the rest still render).
 */
export function parseLiveHealth(body: unknown): LiveHealthPayload | null {
  const envelope = PayloadSchema.safeParse(body);
  if (!envelope.success) return null;

  const metrics: Partial<Record<LiveMetricId, LiveMetric>> = {};
  for (const [key, raw] of Object.entries(envelope.data.metrics)) {
    if (!isLiveMetricId(key)) continue;
    const parsed = MetricSchema.safeParse(raw);
    if (!parsed.success) continue;
    metrics[key] = {
      value: parsed.data.value,
      unit: parsed.data.unit || LIVE_METRIC_UNITS[key],
      quality: parsed.data.quality,
    };
  }

  return {
    ok: true,
    live: envelope.data.live,
    updatedAt: envelope.data.updatedAt ?? null,
    source: envelope.data.source,
    metrics,
  };
}

/** Fold a good payload into the state. */
export function mergeLivePayload(previous: LiveHealthState, payload: LiveHealthPayload): LiveHealthState {
  return {
    data: payload,
    live: payload.live,
    source: payload.source,
    updatedAt: payload.updatedAt,
    settled: true,
    stale: false,
  };
}

/** A failed poll keeps the last good payload — the strip must not flap to the offline label. */
export function markLiveFailure(previous: LiveHealthState): LiveHealthState {
  return { ...previous, settled: true, stale: true };
}

/** How the strip is labelled: fresh simulation, historical seed, or nothing at all. */
export type LiveStripMode = "live" | "historical" | "offline";

export function liveStripMode(data: LiveHealthPayload | null): LiveStripMode {
  if (!data) return "offline";
  if (Object.keys(data.metrics).length === 0) return "offline";
  return data.live && data.source !== "seed" ? "live" : "historical";
}

/** `2026-11-16T09:41:00.000Z` → `09:41 UTC`; unparseable input comes back untouched. */
export function formatLiveUpdatedAt(updatedAt: string | null, locale: string): string {
  if (!updatedAt) return "—";
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return updatedAt;
  try {
    const time = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(date);
    return `${time} UTC`;
  } catch {
    return updatedAt;
  }
}

// ---------------------------------------------------------------------------------------------
// `/` mock console binding: a live value replaces the fixture value, in place, with the fixture
// unit and sparkline. The fixture object is returned untouched when nothing applies, so the
// fallback markup (and every screenshot taken without a live backend) stays byte-identical.
// ---------------------------------------------------------------------------------------------

export interface VitalSignsLike {
  readonly heartRate: { readonly value: number; readonly unit: string; readonly series: readonly number[] };
  readonly bloodPressure: {
    readonly systolic: number;
    readonly diastolic: number;
    readonly unit: string;
    readonly series: readonly number[];
  };
  readonly respiratoryRate: { readonly value: number; readonly unit: string; readonly series: readonly number[] };
  readonly bloodOxygen: { readonly value: number; readonly unit: string; readonly series: readonly number[] };
  readonly bodyTemperature: { readonly value: number; readonly unit: string; readonly series: readonly number[] };
}

function liveValue(
  metrics: Readonly<Partial<Record<LiveMetricId, LiveMetric>>> | null | undefined,
  id: LiveMetricId,
): number | null {
  const metric = metrics?.[id];
  if (!metric || !Number.isFinite(metric.value)) return null;
  return metric.value;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Overlay the live metrics on the HUD fixture. Heart rate / SpO₂ / respiratory rate / blood
 * pressure are integers, the core temperature keeps one decimal — the precision the fixture rows
 * already render. Values only: units and the deterministic sparklines belong to the fixture.
 */
export function applyLiveVitals<T extends VitalSignsLike>(
  vitals: T,
  metrics: Readonly<Partial<Record<LiveMetricId, LiveMetric>>> | null | undefined,
): T {
  const heartRate = liveValue(metrics, "heart_rate_bpm");
  const spo2 = liveValue(metrics, "spo2_pct");
  const respiratory = liveValue(metrics, "respiratory_rate_bpm");
  const core = liveValue(metrics, "core_temperature_c");
  const systolic = liveValue(metrics, "systolic_mmhg");
  const diastolic = liveValue(metrics, "diastolic_mmhg");

  if (
    heartRate === null &&
    spo2 === null &&
    respiratory === null &&
    core === null &&
    systolic === null &&
    diastolic === null
  ) {
    return vitals;
  }

  return {
    ...vitals,
    heartRate: heartRate === null ? vitals.heartRate : { ...vitals.heartRate, value: roundTo(heartRate, 0) },
    bloodPressure:
      systolic === null && diastolic === null
        ? vitals.bloodPressure
        : {
            ...vitals.bloodPressure,
            systolic: systolic === null ? vitals.bloodPressure.systolic : roundTo(systolic, 0),
            diastolic: diastolic === null ? vitals.bloodPressure.diastolic : roundTo(diastolic, 0),
          },
    respiratoryRate:
      respiratory === null ? vitals.respiratoryRate : { ...vitals.respiratoryRate, value: roundTo(respiratory, 0) },
    bloodOxygen: spo2 === null ? vitals.bloodOxygen : { ...vitals.bloodOxygen, value: roundTo(spo2, 0) },
    bodyTemperature: core === null ? vitals.bodyTemperature : { ...vitals.bodyTemperature, value: roundTo(core, 1) },
  };
}
