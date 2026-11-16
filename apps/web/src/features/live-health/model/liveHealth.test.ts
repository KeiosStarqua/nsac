import { describe, expect, it } from "vitest";
import {
  LIVE_HEALTH_INITIAL,
  applyLiveVitals,
  formatLiveUpdatedAt,
  liveStripMode,
  markLiveFailure,
  mergeLivePayload,
  parseLiveHealth,
  type LiveHealthPayload,
} from "./liveHealth";
import { buildLiveStripCards } from "./strip";

const BODY = {
  ok: true,
  live: true,
  updatedAt: "2026-11-16T09:41:00.000Z",
  source: "sim",
  metrics: {
    heart_rate_bpm: { value: 71.4, unit: "bpm", quality: "valid" },
    spo2_pct: { value: 97.6, unit: "%", quality: "valid" },
    respiratory_rate_bpm: { value: 15.2, unit: "br/min", quality: "valid" },
    core_temperature_c: { value: 36.82, unit: "°C", quality: "valid" },
    systolic_mmhg: { value: 121.3, unit: "mmHg", quality: "valid" },
    diastolic_mmhg: { value: 78.6, unit: "mmHg", quality: "valid" },
    activity_counts: { value: 812.2, unit: "cts", quality: "estimated" },
  },
};

function payload(overrides: Partial<LiveHealthPayload> = {}): LiveHealthPayload {
  return {
    ok: true,
    live: true,
    updatedAt: "2026-11-16T09:41:00.000Z",
    source: "sim",
    metrics: { heart_rate_bpm: { value: 70, unit: "bpm", quality: "valid" } },
    ...overrides,
  };
}

describe("parseLiveHealth (frozen contract)", () => {
  it("keeps only contract metric keys and drops malformed rows on their own", () => {
    const parsed = parseLiveHealth({
      ...BODY,
      metrics: {
        ...BODY.metrics,
        co2_ppm: { value: 611, unit: "ppm", quality: "valid" },
        not_a_metric: { value: 1, unit: "x", quality: "valid" },
        power_w: { value: "not a number", unit: "W", quality: "valid" },
      },
    });
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed!.metrics).sort()).toEqual(
      [
        "activity_counts",
        "co2_ppm",
        "core_temperature_c",
        "diastolic_mmhg",
        "heart_rate_bpm",
        "respiratory_rate_bpm",
        "spo2_pct",
        "systolic_mmhg",
      ].sort(),
    );
    expect(parsed!.metrics.co2_ppm?.unit).toBe("ppm");
    expect(parsed!.metrics).not.toHaveProperty("not_a_metric");
    expect(parsed!.metrics).not.toHaveProperty("power_w");
    expect(parsed!.live).toBe(true);
    expect(parsed!.source).toBe("sim");
  });

  it("fills the unit from the contract table when the backend omits one", () => {
    const parsed = parseLiveHealth({
      ok: true,
      live: false,
      updatedAt: null,
      source: "seed",
      metrics: { heart_rate_bpm: { value: 64, quality: "valid" } },
    });
    expect(parsed?.metrics.heart_rate_bpm?.unit).toBe("bpm");
    expect(parsed?.updatedAt).toBeNull();
  });

  it("rejects a body that is not the envelope", () => {
    expect(parseLiveHealth(null)).toBeNull();
    expect(parseLiveHealth("nope")).toBeNull();
    expect(parseLiveHealth({ ok: false })).not.toBeNull(); // lenient: ok is coerced, metrics empty
  });
});

describe("state transitions (last good payload survives a failed poll)", () => {
  it("merges a good payload then keeps it when the next poll fails", () => {
    const first = mergeLivePayload(LIVE_HEALTH_INITIAL, payload());
    expect(first.settled).toBe(true);
    expect(first.stale).toBe(false);
    expect(first.data?.metrics.heart_rate_bpm?.value).toBe(70);

    const failed = markLiveFailure(first);
    expect(failed.data?.metrics.heart_rate_bpm?.value).toBe(70);
    expect(failed.settled).toBe(true);
    expect(failed.stale).toBe(true);
    expect(failed.live).toBe(true);
  });

  it("initial state is not settled (the strip stays hidden until the first read)", () => {
    expect(LIVE_HEALTH_INITIAL.settled).toBe(false);
    expect(LIVE_HEALTH_INITIAL.data).toBeNull();
  });
});

describe("liveStripMode / buildLiveStripCards", () => {
  it("labels fresh simulation, seed history and no payload", () => {
    expect(liveStripMode(null)).toBe("offline");
    expect(liveStripMode(payload())).toBe("live");
    expect(liveStripMode(payload({ live: false, source: "seed" }))).toBe("historical");
    expect(liveStripMode(payload({ live: false }))).toBe("historical");
    expect(liveStripMode(payload({ metrics: {} }))).toBe("offline");
  });

  it("builds only the cards the payload carries, blood pressure as one card", () => {
    const cards = buildLiveStripCards(parseLiveHealth(BODY));
    expect(cards.map((card) => card.id)).toEqual([
      "heart_rate_bpm",
      "spo2_pct",
      "respiratory_rate_bpm",
      "core_temperature_c",
      "blood_pressure",
      "activity_counts",
    ]);
    expect(cards.find((card) => card.id === "heart_rate_bpm")?.value).toBe("71");
    expect(cards.find((card) => card.id === "core_temperature_c")?.value).toBe("36.8");
    expect(cards.find((card) => card.id === "blood_pressure")?.value).toBe("121/79");
    expect(cards.find((card) => card.id === "activity_counts")?.quality).toBe("estimated");
  });

  it("renders a half blood pressure reading instead of inventing the missing half", () => {
    const cards = buildLiveStripCards(payload({ metrics: { systolic_mmhg: { value: 118, unit: "mmHg", quality: "valid" } } }));
    expect(cards).toHaveLength(1);
    expect(cards[0]?.id).toBe("blood_pressure");
    expect(cards[0]?.value).toBe("118/—");
  });

  it("returns no cards for an empty payload", () => {
    expect(buildLiveStripCards(null)).toEqual([]);
    expect(buildLiveStripCards(payload({ metrics: {} }))).toEqual([]);
  });
});

describe("applyLiveVitals (console binding)", () => {
  const VITALS = {
    heartRate: { value: 62, unit: "bpm", series: [1, 2] },
    bloodPressure: { systolic: 118, diastolic: 76, unit: "mmHg", series: [1] },
    respiratoryRate: { value: 16, unit: "br/min", series: [1] },
    bloodOxygen: { value: 98, unit: "%", series: [1] },
    bodyTemperature: { value: 36.7, unit: "°C", series: [1] },
  };

  it("returns the fixture object untouched when there is nothing live", () => {
    expect(applyLiveVitals(VITALS, null)).toBe(VITALS);
    expect(applyLiveVitals(VITALS, {})).toBe(VITALS);
  });

  it("replaces values with the live reading, keeping fixture units and series", () => {
    const live = applyLiveVitals(VITALS, {
      heart_rate_bpm: { value: 88.6, unit: "bpm", quality: "valid" },
      spo2_pct: { value: 96.4, unit: "%", quality: "valid" },
      respiratory_rate_bpm: { value: 21.2, unit: "br/min", quality: "valid" },
      core_temperature_c: { value: 37.24, unit: "°C", quality: "valid" },
      systolic_mmhg: { value: 131.7, unit: "mmHg", quality: "valid" },
      diastolic_mmhg: { value: 84.1, unit: "mmHg", quality: "valid" },
    });
    expect(live).not.toBe(VITALS);
    expect(live.heartRate.value).toBe(89);
    expect(live.heartRate.unit).toBe("bpm");
    expect(live.heartRate.series).toBe(VITALS.heartRate.series);
    expect(live.bloodOxygen.value).toBe(96);
    expect(live.respiratoryRate.value).toBe(21);
    expect(live.bodyTemperature.value).toBe(37.2);
    expect(live.bloodPressure.systolic).toBe(132);
    expect(live.bloodPressure.diastolic).toBe(84);
  });

  it("leaves the rows without a live reading exactly as the fixture had them", () => {
    const live = applyLiveVitals(VITALS, { heart_rate_bpm: { value: 75, unit: "bpm", quality: "valid" } });
    expect(live.heartRate.value).toBe(75);
    expect(live.bloodOxygen).toBe(VITALS.bloodOxygen);
    expect(live.bloodPressure).toBe(VITALS.bloodPressure);
    expect(live.bodyTemperature).toBe(VITALS.bodyTemperature);
  });
});

describe("formatLiveUpdatedAt", () => {
  it("renders a UTC clock and passes unparseable input through", () => {
    expect(formatLiveUpdatedAt("2026-11-16T09:41:00.000Z", "en")).toBe("09:41 UTC");
    expect(formatLiveUpdatedAt(null, "en")).toBe("—");
    expect(formatLiveUpdatedAt("soon", "en")).toBe("soon");
  });
});
