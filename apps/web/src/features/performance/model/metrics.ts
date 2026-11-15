// Contract + presentation model for `/performance` (SKY / Human Performance).
//
// Every number here is synthetic. The backend endpoint is the only live source; when it is
// unreachable the feature falls back to these fixtures and the page says so in one quiet footnote.
// Nothing in this module touches React, the DOM or the network, so vitest covers it directly.
import { z } from "zod";

/** How a metric was obtained. Drives the per-tile method badge. */
export const METHODS = ["estimated", "measured", "self_reported", "simulated"] as const;
export type Method = (typeof METHODS)[number];

/** Canonical tile order (BGK priority): energy first, heart rate last. */
export const METRIC_ORDER = [
  "energy_burned",
  "calories_intake",
  "energy_balance",
  "muscle_mass",
  "muscle_strength",
  "body_fat",
  "sleep_duration",
  "sleep_efficiency",
  "hrv",
  "hydration",
  "exercise_duration",
  "heart_rate",
] as const;

export type MetricId = (typeof METRIC_ORDER)[number];

export interface MetricDefinition {
  id: MetricId;
  /** Tidy display precision; values >= 100 always render with none. */
  decimals: number;
}

export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  { id: "energy_burned", decimals: 0 },
  { id: "calories_intake", decimals: 0 },
  { id: "energy_balance", decimals: 0 },
  { id: "muscle_mass", decimals: 1 },
  { id: "muscle_strength", decimals: 0 },
  { id: "body_fat", decimals: 1 },
  { id: "sleep_duration", decimals: 1 },
  { id: "sleep_efficiency", decimals: 0 },
  { id: "hrv", decimals: 0 },
  { id: "hydration", decimals: 1 },
  { id: "exercise_duration", decimals: 0 },
  { id: "heart_rate", decimals: 0 },
];

/** Backend ids are not frozen yet; accept the obvious spellings and normalize to one id. */
const ALIASES: Readonly<Record<string, MetricId>> = {
  energy_burned: "energy_burned",
  energy_expenditure: "energy_burned",
  active_energy: "energy_burned",
  calories_burned: "energy_burned",
  calories_intake: "calories_intake",
  energy_intake: "calories_intake",
  calorie_intake: "calories_intake",
  energy_balance: "energy_balance",
  calorie_balance: "energy_balance",
  muscle_mass: "muscle_mass",
  lean_mass: "muscle_mass",
  muscle_strength: "muscle_strength",
  strength: "muscle_strength",
  body_fat: "body_fat",
  body_fat_percent: "body_fat",
  bodyfat: "body_fat",
  sleep_duration: "sleep_duration",
  sleep: "sleep_duration",
  total_sleep: "sleep_duration",
  sleep_efficiency: "sleep_efficiency",
  hrv: "hrv",
  heart_rate_variability: "hrv",
  hydration: "hydration",
  water_intake: "hydration",
  fluid_intake: "hydration",
  exercise_duration: "exercise_duration",
  activity_duration: "exercise_duration",
  heart_rate: "heart_rate",
  resting_heart_rate: "heart_rate",
  hr: "heart_rate",
};

/** Normalize a backend metric id ("Heart Rate", "heart-rate") to a canonical id, if known. */
export function metricIdOf(raw: string): MetricId | null {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return ALIASES[key] ?? null;
}

const MetricRowSchema = z.object({
  metric: z.string().trim().min(1),
  unit: z.string().trim().optional().default(""),
  latest: z.number().finite(),
  delta30d: z.number().finite().nullish(),
  points: z.array(z.number().finite()).optional().default([]),
  baseline: z.number().finite().nullish(),
  method: z.enum(METHODS).catch("simulated"),
  quality: z.string().trim().nullish(),
  source: z.string().trim().nullish(),
});

const PayloadSchema = z.object({
  astronautId: z.string().trim().min(1),
  asOf: z.string().trim().optional().default(""),
  metrics: z.array(z.unknown()),
  derived: z
    .object({
      energy_balance: z.number().finite().nullish(),
    })
    .nullish(),
});

export interface PerformanceMetric {
  /** Canonical id when the backend spelling is known, else the normalized raw id. */
  id: string;
  /** The backend spelling, kept for diagnostics. */
  readonly raw: string;
  unit: string;
  latest: number;
  delta30d: number | null;
  points: number[];
  baseline: number | null;
  method: Method;
  quality: string | null;
  source: string | null;
}

export interface PerformancePayload {
  astronautId: string;
  asOf: string;
  metrics: PerformanceMetric[];
  derived: { energy_balance?: number } | null;
}

/**
 * Validate a backend body. A malformed root (no astronautId, metrics not an array) returns
 * `null`; individual malformed rows are dropped like `parseAstronautRows` does, so one bad
 * metric cannot blank the whole page.
 */
export function parsePerformancePayload(input: unknown): PerformancePayload | null {
  const root = PayloadSchema.safeParse(input);
  if (!root.success) return null;
  const metrics: PerformanceMetric[] = [];
  for (const item of root.data.metrics) {
    const row = MetricRowSchema.safeParse(item);
    if (!row.success) continue;
    const value = row.data;
    metrics.push({
      id: metricIdOf(value.metric) ?? value.metric,
      raw: value.metric,
      unit: value.unit,
      latest: value.latest,
      delta30d: value.delta30d ?? null,
      points: value.points,
      baseline: value.baseline ?? null,
      method: value.method,
      quality: value.quality ?? null,
      source: value.source ?? null,
    });
  }
  const derivedBalance = root.data.derived?.energy_balance;
  return {
    astronautId: root.data.astronautId,
    asOf: root.data.asOf,
    metrics,
    derived:
      typeof derivedBalance === "number" && Number.isFinite(derivedBalance)
        ? { energy_balance: derivedBalance }
        : null,
  };
}

/** What the server function resolves: `metrics: null` means "render the fixture fallback". */
export interface PerformanceSnapshot {
  astronautId: string;
  asOf: string | null;
  metrics: PerformanceMetric[] | null;
  derived: { energy_balance?: number } | null;
  reachable: boolean;
}

export function unavailableSnapshot(astronautId: string): PerformanceSnapshot {
  return { astronautId, asOf: null, metrics: null, derived: null, reachable: false };
}

// ---- Fixtures ---------------------------------------------------------------------------------------

const WOBBLE = [0, 0.42, -0.28, 0.18, -0.46, 0.3, -0.12, 0.5, -0.22, 0.08];

/** Deterministic 30-point series from `first` to `last` with a small, repeatable wobble. */
function series(first: number, last: number, wobble: number[] = WOBBLE): number[] {
  const count = 30;
  const out: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const base = first + (last - first) * t;
    const amplitude = Math.max(Math.abs(base) * 0.03, 0.25);
    const noise = wobble[index % wobble.length] ?? 0;
    out.push(Number((base + noise * amplitude).toFixed(3)));
  }
  out[count - 1] = last;
  return out;
}

export interface FixtureMetric {
  id: MetricId;
  unit: string;
  latest: number;
  delta30d: number;
  points: number[];
  baseline: number;
  method: Method;
}

function fixture(
  id: MetricId,
  unit: string,
  latest: number,
  first: number,
  baseline: number,
  method: Method,
): FixtureMetric {
  return {
    id,
    unit,
    latest,
    delta30d: Number((latest - first).toFixed(2)),
    points: series(first, latest),
    baseline,
    method,
  };
}

/**
 * Reference values for the demo stage. They describe a crew member mid-mission (day 170) with a
 * realistic, slightly negative trend: reduced resistance work, short sleep, lower HRV and fluid
 * intake. Synthetic only — never a clinical assessment.
 */
export const FIXTURE_METRICS: Readonly<Record<MetricId, FixtureMetric>> = {
  energy_burned: fixture("energy_burned", "kcal", 2870, 2740, 2750, "measured"),
  calories_intake: fixture("calories_intake", "kcal", 2460, 2570, 2550, "self_reported"),
  energy_balance: fixture("energy_balance", "kcal", -410, -170, -200, "estimated"),
  muscle_mass: fixture("muscle_mass", "kg", 34.6, 35.3, 35.2, "estimated"),
  muscle_strength: fixture("muscle_strength", "N·m", 172, 191, 186, "measured"),
  body_fat: fixture("body_fat", "%", 17.8, 17.1, 17.2, "estimated"),
  sleep_duration: fixture("sleep_duration", "h", 6.4, 7.4, 7.6, "measured"),
  sleep_efficiency: fixture("sleep_efficiency", "%", 86, 92, 91, "estimated"),
  hrv: fixture("hrv", "ms", 48, 60, 58, "measured"),
  hydration: fixture("hydration", "L", 2.1, 2.7, 2.8, "self_reported"),
  exercise_duration: fixture("exercise_duration", "min", 38, 88, 90, "measured"),
  heart_rate: fixture("heart_rate", "bpm", 63, 57, 58, "measured"),
};

/** The dynamic series that the insight rule inspects (fixtures when the backend is absent). */
export function insightSeries(snapshot: PerformanceSnapshot): Array<{
  id: MetricId;
  points: number[];
  baseline: number;
}> {
  return METRIC_ORDER.map((id) => {
    const live = findMetric(snapshot.metrics, id);
    if (live) {
      return {
        id,
        points: live.points.length > 0 ? live.points : [live.latest],
        baseline: live.baseline ?? mean(live.points),
      };
    }
    const fallback = FIXTURE_METRICS[id];
    return { id, points: fallback.points, baseline: fallback.baseline };
  });
}

function findMetric(metrics: PerformanceMetric[] | null, id: MetricId): PerformanceMetric | undefined {
  return metrics?.find((metric) => metric.id === id);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// ---- Tile presentation ------------------------------------------------------------------------------

export type DeltaDirection = "up" | "down" | "flat";

export interface MetricTileModel {
  id: MetricId;
  label: string;
  value: string;
  unit: string;
  deltaText: string;
  direction: DeltaDirection;
  points: number[];
  method: Method;
  methodLabel: string;
  baseline: number | null;
  /** True when this tile's numbers came from the bundled fixture instead of the backend. */
  fromFixture: boolean;
}

export interface TileLabels {
  metrics: Record<MetricId, string>;
  methods: Record<Method, string>;
}

const numberFormatCache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, decimals: number): Intl.NumberFormat {
  const key = `${locale}:${decimals}`;
  const cached = numberFormatCache.get(key);
  if (cached) return cached;
  const next = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  numberFormatCache.set(key, next);
  return next;
}

/** Tidy number: the metric's precision, but never decimals once a value reaches three digits. */
export function formatMetricValue(value: number, decimals: number, locale: string): string {
  const precision = Math.abs(value) >= 100 ? 0 : decimals;
  return formatter(locale, precision).format(value);
}

export function deltaDirection(delta: number): DeltaDirection {
  if (delta > 0.0001) return "up";
  if (delta < -0.0001) return "down";
  return "flat";
}

/**
 * The quiet "as of" footnote: a UTC time, formatted in the active locale. Deterministic across
 * server and client (fixed time zone), and an unparseable timestamp is shown as-is.
 */
export function formatAsOf(asOf: string | null, locale: string): string {
  if (!asOf) return "—";
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) return asOf;
  try {
    const time = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(date);
    return `${time} UTC`;
  } catch {
    return asOf;
  }
}

function signed(value: number, decimals: number, locale: string): string {
  if (Math.abs(value) < 0.0001) return formatter(locale, decimals).format(0);
  const magnitude = formatMetricValue(Math.abs(value), decimals, locale);
  return `${value > 0 ? "+" : "−"}${magnitude}`;
}

/**
 * Energy balance = intake − burned, in the intake unit (kcal). Preference order: the backend's
 * derived value, then a series computed from the two live metrics, then the fixture.
 */
function resolveEnergyBalance(
  snapshot: PerformanceSnapshot,
  live: Map<string, PerformanceMetric>,
): { latest: number; unit: string; points: number[]; delta: number; baseline: number | null; method: Method; fromFixture: boolean } {
  const intake = live.get("calories_intake");
  const burned = live.get("energy_burned");
  const derived = snapshot.derived?.energy_balance;
  const unit = intake?.unit || burned?.unit || FIXTURE_METRICS.energy_balance.unit;

  if (typeof derived === "number" && Number.isFinite(derived)) {
    const points =
      intake && burned && intake.points.length === burned.points.length
        ? intake.points.map((value, index) => Number((value - (burned.points[index] ?? 0)).toFixed(2)))
        : [];
    const baseline =
      intake && burned && typeof intake.baseline === "number" && typeof burned.baseline === "number"
        ? intake.baseline - burned.baseline
        : null;
    return {
      latest: derived,
      unit,
      points: points.length > 0 ? points : [derived],
      delta: points.length > 1 ? Number((derived - points[0]!).toFixed(2)) : 0,
      baseline,
      method: "estimated",
      fromFixture: false,
    };
  }

  if (intake && burned) {
    const length = Math.min(intake.points.length, burned.points.length);
    const points: number[] = [];
    for (let index = 0; index < length; index += 1) {
      points.push(Number((intake.points[index]! - burned.points[index]!).toFixed(2)));
    }
    const latest = intake.latest - burned.latest;
    const baseline =
      typeof intake.baseline === "number" && typeof burned.baseline === "number"
        ? intake.baseline - burned.baseline
        : null;
    return {
      latest,
      unit,
      points: points.length > 0 ? points : [latest],
      delta: points.length > 1 ? Number((latest - points[0]!).toFixed(2)) : 0,
      baseline,
      method: "estimated",
      fromFixture: false,
    };
  }

  const fallback = FIXTURE_METRICS.energy_balance;
  return {
    latest: fallback.latest,
    unit,
    points: fallback.points,
    delta: fallback.delta30d,
    baseline: fallback.baseline,
    method: fallback.method,
    fromFixture: true,
  };
}

/**
 * Turn a snapshot into the 12 tiles. A missing live metric falls back to the fixture and is
 * marked `fromFixture`, so the page can still show all 12 tiles after a partial backend answer.
 */
export function buildMetricTiles(
  snapshot: PerformanceSnapshot,
  labels: TileLabels,
  locale: string,
): MetricTileModel[] {
  const live = new Map<string, PerformanceMetric>();
  for (const metric of snapshot.metrics ?? []) live.set(metric.id, metric);

  const balance = resolveEnergyBalance(snapshot, live);

  return METRIC_DEFINITIONS.map((definition) => {
    const id = definition.id;
    const label = labels.metrics[id];

    if (id === "energy_balance") {
      return {
        id,
        label,
        value: formatMetricValue(balance.latest, definition.decimals, locale),
        unit: balance.unit,
        deltaText: `${signed(balance.delta, definition.decimals, locale)} ${balance.unit}`.trim(),
        direction: deltaDirection(balance.delta),
        points: balance.points,
        method: balance.method,
        methodLabel: labels.methods[balance.method],
        baseline: balance.baseline,
        fromFixture: balance.fromFixture,
      };
    }

    const metric = live.get(id);
    if (metric) {
      const delta = metric.delta30d ?? (metric.points.length > 1 ? metric.latest - metric.points[0]! : 0);
      return {
        id,
        label,
        value: formatMetricValue(metric.latest, definition.decimals, locale),
        unit: metric.unit,
        deltaText: `${signed(delta, definition.decimals, locale)} ${metric.unit}`.trim(),
        direction: deltaDirection(delta),
        points: metric.points.length > 0 ? metric.points : [metric.latest],
        method: metric.method,
        methodLabel: labels.methods[metric.method],
        baseline: metric.baseline,
        fromFixture: false,
      };
    }

    const fallback = FIXTURE_METRICS[id];
    return {
      id,
      label,
      value: formatMetricValue(fallback.latest, definition.decimals, locale),
      unit: fallback.unit,
      deltaText: `${signed(fallback.delta30d, definition.decimals, locale)} ${fallback.unit}`.trim(),
      direction: deltaDirection(fallback.delta30d),
      points: fallback.points,
      method: fallback.method,
      methodLabel: labels.methods[fallback.method],
      baseline: fallback.baseline,
      fromFixture: true,
    };
  });
}
