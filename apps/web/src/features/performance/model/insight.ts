// Deterministic one-line insight for `/performance`.
//
// This is NOT a model call and never will be: the rule reads a 30-point series and its baseline
// and returns a fixed rule id plus the NASA source that backs the guidance. The page renders the
// localized sentence for that rule. Pure module — vitest covers it.
import type { MetricId } from "./metrics";

export type InsightRule = "muscle" | "sleep" | "hrv" | "hydration" | "steady";

export interface SeriesTrend {
  latest: number | null;
  baseline: number;
  /** latest − baseline (0 when there are no points). */
  delta: number;
  /** Least-squares slope over the last 14 points, in series units per point. */
  slope: number;
  /** latest as a fraction of baseline; null when the baseline is not positive. */
  ratio: number | null;
}

/** How many trailing points the trend reads. */
export const TREND_WINDOW = 14;

/**
 * Trend of one series against its baseline. `skyInsight(points, baseline)` is the unit the rule
 * is built on: the page passes the priority metric's 30-day points and its simulated baseline.
 */
export function skyInsight(points: number[], baseline: number): SeriesTrend {
  const clean = points.filter((value) => Number.isFinite(value));
  const latest = clean.length > 0 ? clean[clean.length - 1]! : null;
  const delta = latest === null ? 0 : latest - baseline;
  return {
    latest,
    baseline,
    delta,
    slope: leastSquaresSlope(clean.slice(-TREND_WINDOW)),
    ratio: latest === null || !(baseline > 0) ? null : latest / baseline,
  };
}

function leastSquaresSlope(values: number[]): number {
  const count = values.length;
  if (count < 2) return 0;
  const meanX = (count - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < count; index += 1) {
    const dx = index - meanX;
    numerator += dx * (values[index]! - meanY);
    denominator += dx * dx;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

export interface InsightSeries {
  id: MetricId;
  points: number[];
  baseline: number;
}

export interface SkyInsight {
  rule: InsightRule;
  /** The metric the rule fired on, or null for the steady fallback. */
  metricId: MetricId | null;
  trend: SeriesTrend | null;
  sourceUrl: string;
  sourceTitle: string;
}

interface RuleSource {
  sourceUrl: string;
  sourceTitle: string;
}

/** Vetted NASA HRP references (docs/references/spaceapps-resources-2026/nasa-hrp). */
export const INSIGHT_SOURCES: Readonly<Record<InsightRule, RuleSource>> = {
  muscle: {
    sourceUrl: "https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness",
    sourceTitle: "NASA HRP — Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness",
  },
  sleep: {
    sourceUrl: "https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules",
    sourceTitle: "NASA HRP — Risk from Inadequate Sleep and Irregular Schedules",
  },
  hrv: {
    sourceUrl: "https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations",
    sourceTitle: "NASA HRP — Risk of Cardiovascular Adaptations",
  },
  hydration: {
    sourceUrl: "https://www.nasa.gov/reference/risk-of-inadequate-food-and-nutrition",
    sourceTitle: "NASA HRP — Risk of Inadequate Food and Nutrition",
  },
  steady: {
    sourceUrl: "https://www.nasa.gov/hrp/risks/",
    sourceTitle: "NASA HRP — Human Spaceflight Risks",
  },
};

const SLEEP_RATIO = 0.9;
const HRV_RATIO = 0.95;
const HYDRATION_RATIO = 0.9;

function insight(rule: InsightRule, metricId: MetricId | null, trend: SeriesTrend | null): SkyInsight {
  return { rule, metricId, trend, ...INSIGHT_SOURCES[rule] };
}

/**
 * Pick the highest-priority rule that fires. Priority follows the BGK tile order: an active
 * muscle-strength decline first, then sleep, HRV and hydration; otherwise the steady line.
 */
export function selectSkyInsight(series: InsightSeries[]): SkyInsight {
  const byId = new Map(series.map((entry) => [entry.id, entry]));

  const muscle = byId.get("muscle_strength");
  if (muscle) {
    const trend = skyInsight(muscle.points, muscle.baseline);
    if (trend.slope < 0) return insight("muscle", "muscle_strength", trend);
  }

  const sleep = byId.get("sleep_duration");
  if (sleep) {
    const trend = skyInsight(sleep.points, sleep.baseline);
    if (trend.ratio !== null && trend.ratio < SLEEP_RATIO) return insight("sleep", "sleep_duration", trend);
  }

  const hrv = byId.get("hrv");
  if (hrv) {
    const trend = skyInsight(hrv.points, hrv.baseline);
    if (trend.ratio !== null && trend.ratio < HRV_RATIO) return insight("hrv", "hrv", trend);
  }

  const hydration = byId.get("hydration");
  if (hydration) {
    const trend = skyInsight(hydration.points, hydration.baseline);
    if (trend.ratio !== null && trend.ratio < HYDRATION_RATIO) {
      return insight("hydration", "hydration", trend);
    }
  }

  return insight("steady", null, null);
}
