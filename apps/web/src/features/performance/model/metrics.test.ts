import { describe, expect, it } from "vitest";
import {
  METRIC_ORDER,
  buildMetricTiles,
  deltaDirection,
  formatAsOf,
  formatMetricValue,
  insightSeries,
  parsePerformancePayload,
  unavailableSnapshot,
  type MetricId,
  type PerformanceMetric,
  type PerformanceSnapshot,
  type TileLabels,
} from "./metrics";

const labels: TileLabels = {
  metrics: Object.fromEntries(METRIC_ORDER.map((id) => [id, id])) as Record<MetricId, string>,
  methods: {
    estimated: "est.",
    measured: "measured",
    self_reported: "self-report",
    simulated: "simulated",
  },
};

function metric(overrides: Partial<PerformanceMetric> = {}): PerformanceMetric {
  return {
    id: "heart_rate",
    raw: "heart_rate",
    unit: "bpm",
    latest: 62,
    delta30d: 2,
    points: [58, 60, 62],
    baseline: 58,
    method: "measured",
    quality: null,
    source: null,
    ...overrides,
  };
}

describe("parsePerformancePayload", () => {
  it("accepts the documented contract and normalizes ids and derived values", () => {
    const parsed = parsePerformancePayload({
      astronautId: "ayla-reyes",
      asOf: "2026-11-15T08:00:00Z",
      metrics: [
        {
          metric: "heart-rate",
          unit: "bpm",
          latest: 62,
          delta30d: 3,
          points: [60, 61, 62],
          baseline: 58,
          method: "measured",
          quality: "good",
          source: "simulated",
        },
      ],
      derived: { energy_balance: -300 },
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.astronautId).toBe("ayla-reyes");
    expect(parsed!.asOf).toBe("2026-11-15T08:00:00Z");
    expect(parsed!.metrics).toHaveLength(1);
    expect(parsed!.metrics[0]!.id).toBe("heart_rate");
    expect(parsed!.metrics[0]!.raw).toBe("heart-rate");
    expect(parsed!.metrics[0]!.method).toBe("measured");
    expect(parsed!.derived).toEqual({ energy_balance: -300 });
  });

  it("rejects a malformed root instead of guessing", () => {
    expect(parsePerformancePayload(null)).toBeNull();
    expect(parsePerformancePayload("nope")).toBeNull();
    expect(parsePerformancePayload({})).toBeNull();
    expect(parsePerformancePayload({ astronautId: "a", metrics: "nope" })).toBeNull();
    expect(parsePerformancePayload({ astronautId: "", metrics: [] })).toBeNull();
  });

  it("drops malformed rows and keeps the valid ones", () => {
    const parsed = parsePerformancePayload({
      astronautId: "ayla-reyes",
      metrics: [
        { metric: "hrv", unit: "ms", latest: 48, points: [50, 48], baseline: 58, method: "measured" },
        { metric: "sleep_duration", unit: "h" },
        { nope: true },
      ],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.metrics).toHaveLength(1);
    expect(parsed!.metrics[0]!.id).toBe("hrv");
  });

  it("falls back to the simulated method for an unknown method string", () => {
    const parsed = parsePerformancePayload({
      astronautId: "ayla-reyes",
      metrics: [{ metric: "body_fat", unit: "%", latest: 18, method: "guessed" }],
    });
    expect(parsed!.metrics[0]!.method).toBe("simulated");
  });

  it("tolerates a missing baseline, delta and points", () => {
    const parsed = parsePerformancePayload({
      astronautId: "ayla-reyes",
      metrics: [{ metric: "hydration", unit: "L", latest: 2.1 }],
    });
    const row = parsed!.metrics[0]!;
    expect(row.baseline).toBeNull();
    expect(row.delta30d).toBeNull();
    expect(row.points).toEqual([]);
  });
});

describe("deltaDirection / formatMetricValue", () => {
  it("classifies the 30-day direction", () => {
    expect(deltaDirection(2)).toBe("up");
    expect(deltaDirection(-2)).toBe("down");
    expect(deltaDirection(0)).toBe("flat");
  });

  it("keeps the metric precision below three digits and drops it above", () => {
    expect(formatMetricValue(34.64, 1, "en")).toBe("34.6");
    expect(formatMetricValue(172.4, 1, "en")).toBe("172");
    expect(formatMetricValue(7.25, 1, "en")).toBe("7.3");
  });

  it("formats the as-of footnote deterministically in UTC", () => {
    expect(formatAsOf("2026-11-15T08:05:00Z", "en")).toBe("08:05 UTC");
    expect(formatAsOf(null, "en")).toBe("—");
    expect(formatAsOf("not-a-date", "en")).toBe("not-a-date");
  });
});

describe("buildMetricTiles", () => {
  it("always renders all 12 tiles in BGK order, from the fixture when the backend is down", () => {
    const snapshot = unavailableSnapshot("ayla-reyes");
    const tiles = buildMetricTiles(snapshot, labels, "en");

    expect(tiles).toHaveLength(12);
    expect(tiles.map((tile) => tile.id)).toEqual([...METRIC_ORDER]);
    expect(tiles.every((tile) => tile.fromFixture)).toBe(true);
    expect(tiles.every((tile) => tile.points.length > 1)).toBe(true);
    expect(tiles[0]!.value).toBe("2,870");
    expect(tiles[0]!.unit).toBe("kcal");
    expect(tiles[4]!.direction).toBe("down");
    expect(tiles[4]!.methodLabel).toBe("measured");
  });

  it("labels live metrics with their method and delta", () => {
    const snapshot: PerformanceSnapshot = {
      astronautId: "ayla-reyes",
      asOf: "2026-11-15T08:00:00Z",
      reachable: true,
      derived: { energy_balance: 300 },
      metrics: [
        metric({
          id: "energy_burned",
          raw: "energy_burned",
          unit: "kcal",
          latest: 2600,
          delta30d: 100,
          points: [2500, 2550, 2600],
          baseline: 2500,
        }),
        metric({
          id: "calories_intake",
          raw: "calories_intake",
          unit: "kcal",
          latest: 2900,
          delta30d: 100,
          points: [2800, 2850, 2900],
          baseline: 2800,
          method: "self_reported",
        }),
      ],
    };

    const tiles = buildMetricTiles(snapshot, labels, "en");
    expect(tiles).toHaveLength(12);

    const burned = tiles[0]!;
    expect(burned.value).toBe("2,600");
    expect(burned.fromFixture).toBe(false);
    expect(burned.direction).toBe("up");
    expect(burned.deltaText).toContain("+");
    expect(burned.methodLabel).toBe("measured");

    const balance = tiles.find((tile) => tile.id === "energy_balance")!;
    expect(balance.value).toBe("300");
    expect(balance.unit).toBe("kcal");
    expect(balance.fromFixture).toBe(false);
    expect(balance.methodLabel).toBe("est.");

    // A metric the backend omitted still renders, marked as a fixture.
    const muscle = tiles.find((tile) => tile.id === "muscle_mass")!;
    expect(muscle.fromFixture).toBe(true);
  });

  it("derives energy balance from intake and burned when the backend omits `derived`", () => {
    const snapshot: PerformanceSnapshot = {
      astronautId: "ayla-reyes",
      asOf: null,
      reachable: true,
      derived: null,
      metrics: [
        metric({
          id: "energy_burned",
          raw: "energy_burned",
          unit: "kcal",
          latest: 2600,
          points: [2400, 2500, 2600],
          baseline: 2500,
        }),
        metric({
          id: "calories_intake",
          raw: "calories_intake",
          unit: "kcal",
          latest: 3000,
          points: [2700, 2850, 3000],
          baseline: 2800,
        }),
      ],
    };

    const balance = buildMetricTiles(snapshot, labels, "en").find((tile) => tile.id === "energy_balance")!;
    expect(balance.value).toBe("400");
    expect(balance.deltaText).toContain("+100");
    expect(balance.baseline).toBe(300);
  });
});

describe("insightSeries", () => {
  it("replaces a missing live metric with its fixture", () => {
    const series = insightSeries(unavailableSnapshot("ayla-reyes"));
    expect(series).toHaveLength(12);
    expect(series.find((entry) => entry.id === "muscle_strength")!.points.length).toBe(30);
  });

  it("prefers live points and baseline when present", () => {
    const snapshot: PerformanceSnapshot = {
      astronautId: "ayla-reyes",
      asOf: null,
      reachable: true,
      derived: null,
      metrics: [metric({ id: "hrv", raw: "hrv", unit: "ms", latest: 40, points: [55, 48, 40], baseline: 52 })],
    };
    const series = insightSeries(snapshot);
    expect(series.find((entry) => entry.id === "hrv")).toEqual({ id: "hrv", points: [55, 48, 40], baseline: 52 });
  });
});
