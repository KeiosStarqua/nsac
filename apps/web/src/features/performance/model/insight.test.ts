import { describe, expect, it } from "vitest";
import { INSIGHT_SOURCES, TREND_WINDOW, selectSkyInsight, skyInsight, type InsightSeries } from "./insight";

const descending = Array.from({ length: 30 }, (_, index) => 100 - index * 2);
const flat = Array.from({ length: 30 }, () => 100);
const rising = Array.from({ length: 30 }, (_, index) => 80 + index);

function seriesOf(overrides: Partial<Record<string, number[]>> = {}, baselines: Partial<Record<string, number>> = {}): InsightSeries[] {
  const base: InsightSeries[] = [
    { id: "muscle_strength", points: overrides.muscle_strength ?? flat, baseline: baselines.muscle_strength ?? 100 },
    { id: "sleep_duration", points: overrides.sleep_duration ?? flat, baseline: baselines.sleep_duration ?? 100 },
    { id: "hrv", points: overrides.hrv ?? flat, baseline: baselines.hrv ?? 100 },
    { id: "hydration", points: overrides.hydration ?? flat, baseline: baselines.hydration ?? 100 },
  ];
  return base;
}

describe("skyInsight", () => {
  it("returns the latest value and its delta against the baseline", () => {
    const trend = skyInsight([10, 11, 12], 10);
    expect(trend.latest).toBe(12);
    expect(trend.delta).toBe(2);
    expect(trend.ratio).toBeCloseTo(1.2);
  });

  it("computes a positive least-squares slope for a rising series", () => {
    expect(skyInsight(rising, 100).slope).toBeGreaterThan(0);
  });

  it("computes a negative slope for a declining series", () => {
    expect(skyInsight(descending, 100).slope).toBeLessThan(0);
  });

  it("returns a flat slope for a constant series", () => {
    expect(skyInsight(flat, 100).slope).toBe(0);
  });

  it("reads only the trailing 14-point window", () => {
    // A long flat run followed by a steep drop: only the recent window can move the slope.
    const points = [...Array.from({ length: 20 }, () => 100), ...Array.from({ length: 10 }, (_, index) => 90 - index)];
    expect(skyInsight(points, 100).slope).toBeLessThan(0);
    expect(TREND_WINDOW).toBe(14);
  });

  it("is safe with no points", () => {
    const trend = skyInsight([], 42);
    expect(trend.latest).toBeNull();
    expect(trend.delta).toBe(0);
    expect(trend.slope).toBe(0);
    expect(trend.ratio).toBeNull();
  });
});

describe("selectSkyInsight", () => {
  it("fires the muscle rule when the 14-day strength slope is negative", () => {
    const insight = selectSkyInsight(seriesOf({ muscle_strength: descending }));
    expect(insight.rule).toBe("muscle");
    expect(insight.metricId).toBe("muscle_strength");
    expect(insight.trend?.slope).toBeLessThan(0);
    expect(insight.sourceUrl).toBe(INSIGHT_SOURCES.muscle.sourceUrl);
  });

  it("prefers muscle strength over a simultaneous sleep dip", () => {
    const insight = selectSkyInsight(
      seriesOf({ muscle_strength: descending, sleep_duration: flat.map(() => 70) }, { sleep_duration: 100 }),
    );
    expect(insight.rule).toBe("muscle");
  });

  it("fires the sleep rule when strength is flat and sleep sits under its baseline", () => {
    const insight = selectSkyInsight(seriesOf({ sleep_duration: flat.map(() => 60) }));
    expect(insight.rule).toBe("sleep");
    expect(insight.sourceTitle).toContain("Sleep");
  });

  it("fires the HRV rule after muscle and sleep pass", () => {
    const insight = selectSkyInsight(seriesOf({ hrv: flat.map(() => 80) }));
    expect(insight.rule).toBe("hrv");
    expect(insight.sourceTitle).toContain("Cardiovascular");
  });

  it("fires the hydration rule last", () => {
    const insight = selectSkyInsight(seriesOf({ hydration: flat.map(() => 50) }));
    expect(insight.rule).toBe("hydration");
    expect(insight.sourceTitle).toContain("Food and Nutrition");
  });

  it("falls back to steady when every metric tracks its baseline", () => {
    const insight = selectSkyInsight(seriesOf());
    expect(insight.rule).toBe("steady");
    expect(insight.metricId).toBeNull();
    expect(insight.sourceUrl).toBe(INSIGHT_SOURCES.steady.sourceUrl);
  });

  it("every rule carries a NASA source", () => {
    for (const source of Object.values(INSIGHT_SOURCES)) {
      expect(source.sourceUrl.startsWith("https://www.nasa.gov/")).toBe(true);
      expect(source.sourceTitle.length).toBeGreaterThan(0);
    }
  });
});
