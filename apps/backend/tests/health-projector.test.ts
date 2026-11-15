import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TelemetryEvent } from "../src/sensors/envelope";
import type { HealthFact } from "../src/health/rules";

const dir = mkdtempSync(join(tmpdir(), "sky-health-projector-test-"));
process.env.SKY_DB_PATH = join(dir, "projector-singleton.db");

type ClientModule = typeof import("../src/db/client");
type LiveRepoModule = typeof import("../src/db/repositories/healthLive");
type ProjectorModule = typeof import("../src/health/projector");
type RulesModule = typeof import("../src/health/rules");

let ensureHealthLiveSchema: ClientModule["ensureHealthLiveSchema"];
let MISSION_SCOPE: LiveRepoModule["MISSION_SCOPE"];
let SqliteHealthLiveStore: LiveRepoModule["SqliteHealthLiveStore"];
let HealthProjector: ProjectorModule["HealthProjector"];
let projectEvents: ProjectorModule["projectEvents"];
let HealthRulesEngine: RulesModule["HealthRulesEngine"];

beforeAll(async () => {
  ({ ensureHealthLiveSchema } = await import("../src/db/client"));
  ({ MISSION_SCOPE, SqliteHealthLiveStore } = await import("../src/db/repositories/healthLive"));
  ({ HealthProjector, projectEvents } = await import("../src/health/projector"));
  ({ HealthRulesEngine } = await import("../src/health/rules"));
});

// PR2 — projector mapping + health_current/rollups; PR4 — facts qua projector (publisher inject).

afterAll(() => {
  delete process.env.SKY_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

const T0 = Date.UTC(2026, 10, 15, 6, 0, 0);

let eventSeq = 0;

function makeEvent(opts: {
  deviceId: string;
  crewId?: string;
  payload: Record<string, unknown>;
  atMs: number;
  quality?: "good" | "suspect" | "invalid";
}): TelemetryEvent {
  eventSeq += 1;
  return {
    schema_version: "1.0",
    event_id: `ev-${String(eventSeq).padStart(6, "0")}-0000-4000-8000-000000000000`.slice(0, 36).padEnd(36, "0"),
    mission_id: "SIM-001",
    ...(opts.crewId ? { crew_id: opts.crewId } : {}),
    device_id: opts.deviceId,
    device_type: opts.deviceId,
    location_id: "HAB-01",
    source: { mode: "synthetic" },
    observed_at: new Date(opts.atMs).toISOString(),
    received_at: new Date(opts.atMs).toISOString(),
    sequence: eventSeq,
    quality: { status: opts.quality ?? "good" },
    payload: opts.payload,
  } as TelemetryEvent;
}

function frame(atMs: number, opts: { crewId?: string; hr?: number; quality?: "good" | "suspect" | "invalid" } = {}): TelemetryEvent[] {
  const crewId = opts.crewId ?? "ayla-reyes";
  return [
    makeEvent({ deviceId: "biomonitor", crewId, atMs, quality: opts.quality, payload: { heart_rate_bpm: opts.hr ?? 68, spo2_pct: 98, respiratory_rate_bpm: 14, skin_temperature_c: 33.5, activity_counts: 5 } }),
    makeEvent({ deviceId: "pulse-oximeter", crewId, atMs, payload: { spo2_pct: 98, pulse_bpm: 68, signal_quality: 0.9 } }),
    makeEvent({ deviceId: "respiratory-assessment", crewId, atMs, payload: { respiratory_rate_bpm: 14, tidal_volume_ml: 500, minute_ventilation_l_min: 7 } }),
    makeEvent({ deviceId: "thermo-mini", crewId, atMs, payload: { core_temperature_c: 37.01 } }),
    makeEvent({ deviceId: "bp-ecg", crewId, atMs, payload: { systolic_mmhg: 118, diastolic_mmhg: 76, heart_rate_bpm: 68 } }),
    makeEvent({ deviceId: "cad", crewId, atMs, payload: { dose_rate_uSv_h: 0.5, cumulative_equivalent_dose_mSv: 0.001 } }),
    makeEvent({ deviceId: "o2-analyzer", atMs, payload: { o2_pct: 20.9 } }),
    makeEvent({ deviceId: "co2-analyzer", atMs, payload: { co2_ppm: 850 } }),
    makeEvent({ deviceId: "pressure-sensor", atMs, payload: { pressure_kpa: 101.3 } }),
    makeEvent({ deviceId: "temperature-sensor", atMs, payload: { temperature_c: 23.5 } }),
    makeEvent({ deviceId: "humidity-sensor", atMs, payload: { humidity_pct: 40 } }),
  ];
}

function makeStore(name: string) {
  const db = new Database(join(dir, `${name}.db`));
  db.exec("PRAGMA journal_mode = WAL;");
  ensureHealthLiveSchema(db);
  return { db, store: new SqliteHealthLiveStore(db) };
}

describe("projectEvents (payload → health metric)", () => {
  test("maps every documented metric with its unit", () => {
    const events = [
      ...frame(T0),
      makeEvent({ deviceId: "ergometer", crewId: "ayla-reyes", atMs: T0, payload: { power_w: 140, cadence_rpm: 85, session_id: "ergo-x", elapsed_s: 12, heart_rate_bpm: 142 } }),
    ];
    const { crew, mission } = projectEvents(events);
    const ayla = crew.find((batch) => batch.subject === "ayla-reyes")!;
    expect(ayla.metrics.heart_rate_bpm).toEqual({ value: 68, unit: "bpm", quality: "valid" });
    expect(ayla.metrics.spo2_pct).toEqual({ value: 98, unit: "%", quality: "valid" });
    expect(ayla.metrics.respiratory_rate_bpm!.unit).toBe("breaths/min");
    expect(ayla.metrics.core_temperature_c).toEqual({ value: 37.01, unit: "°C", quality: "valid" });
    expect(ayla.metrics.skin_temperature_c).toEqual({ value: 33.5, unit: "°C", quality: "valid" });
    expect(ayla.metrics.systolic_mmhg).toEqual({ value: 118, unit: "mmHg", quality: "valid" });
    expect(ayla.metrics.diastolic_mmhg).toEqual({ value: 76, unit: "mmHg", quality: "valid" });
    expect(ayla.metrics.activity_counts).toEqual({ value: 5, unit: "counts", quality: "valid" });
    expect(ayla.metrics.dose_rate_uSv_h).toEqual({ value: 0.5, unit: "µSv/h", quality: "valid" });
    expect(ayla.metrics.power_w).toEqual({ value: 140, unit: "W", quality: "valid" });
    expect(ayla.metrics.cadence_rpm).toEqual({ value: 85, unit: "rpm", quality: "valid" });
    expect(ayla.metrics.elapsed_s).toEqual({ value: 12, unit: "s", quality: "valid" });

    expect(mission!.subject).toBe(MISSION_SCOPE);
    expect(mission!.metrics.co2_ppm).toEqual({ value: 850, unit: "ppm", quality: "valid" });
    expect(mission!.metrics.o2_pct).toEqual({ value: 20.9, unit: "%", quality: "valid" });
    expect(mission!.metrics.temperature_c).toEqual({ value: 23.5, unit: "°C", quality: "valid" });
    expect(mission!.metrics.humidity_pct).toEqual({ value: 40, unit: "%", quality: "valid" });
    expect(mission!.metrics.pressure_kpa).toEqual({ value: 101.3, unit: "kPa", quality: "valid" });
    // Dose aggregate ở mission scope cho rule radiation (mission trailing median).
    expect(mission!.metrics.dose_rate_uSv_h!.value).toBe(0.5);
  });

  test("never fabricates hrv_ms (no telemetry source)", () => {
    const { crew, mission } = projectEvents(frame(T0));
    expect(crew[0].metrics.hrv_ms).toBeUndefined();
    expect(mission!.metrics.hrv_ms).toBeUndefined();
  });

  test("carries the worst quality of duplicate metric events in one frame", () => {
    const events = [
      ...frame(T0, { quality: "suspect" }),
      makeEvent({ deviceId: "biomonitor", crewId: "ayla-reyes", atMs: T0, payload: { heart_rate_bpm: 120, spo2_pct: 97, respiratory_rate_bpm: 15, skin_temperature_c: 33.6, activity_counts: 9 } }),
    ];
    const ayla = projectEvents(events).crew.find((batch) => batch.subject === "ayla-reyes")!;
    expect(ayla.metrics.heart_rate_bpm!.quality).toBe("suspect");
    expect(ayla.metrics.heart_rate_bpm!.value).toBe(120); // max value giữ được (worst quality đi kèm)
  });
});

describe("HealthProjector — health_current + rollups", () => {
  test("UPSERT keeps one row per (astronaut, metric) and refreshes the value", () => {
    const { db, store } = makeStore("upsert");
    const projector = new HealthProjector({ store, publish: () => {}, rules: new HealthRulesEngine() });

    projector.ingest(frame(T0, { hr: 68 }));
    expect(store.countCurrent()).toBeGreaterThan(0);
    const first = store.currentByAstronaut("ayla-reyes");
    const before = first.find((row) => row.metric === "heart_rate_bpm")!;
    expect(before.value).toBe(68);

    projector.ingest(frame(T0 + 1000, { hr: 71 }));
    const rows = store.currentByAstronaut("ayla-reyes");
    const hr = rows.filter((row) => row.metric === "heart_rate_bpm");
    expect(hr.length).toBe(1);
    expect(hr[0].value).toBe(71);
    expect(hr[0].measuredAt).toBe(new Date(T0 + 1000).toISOString());
    expect(hr[0].source).toBe("sim");
    db.close();
  });

  test("invalid-quality readings are dropped; suspect is kept as suspect", () => {
    const { db, store } = makeStore("quality");
    const projector = new HealthProjector({ store, publish: () => {}, rules: new HealthRulesEngine() });
    projector.ingest(frame(T0, { quality: "invalid" }));
    // Chỉ event biomonitor bị invalid ⇒ metric của nó không được ghi, các device khác vẫn good.
    const afterInvalid = store.currentByAstronaut("ayla-reyes");
    expect(afterInvalid.some((row) => row.metric === "heart_rate_bpm")).toBe(false);
    expect(afterInvalid.some((row) => row.metric === "skin_temperature_c")).toBe(false);
    expect(afterInvalid.some((row) => row.metric === "systolic_mmhg")).toBe(true);

    projector.ingest(frame(T0 + 1000, { quality: "suspect" }));
    const rows = store.currentByAstronaut("ayla-reyes");
    expect(rows.find((row) => row.metric === "heart_rate_bpm")!.quality).toBe("suspect");
    expect(rows.find((row) => row.metric === "systolic_mmhg")!.quality).toBe("valid");
    db.close();
  });

  test("1m rollups aggregate min/max/avg/count, and 1h rollups derive on the fly", () => {
    const { db, store } = makeStore("rollups");
    const projector = new HealthProjector({ store, publish: () => {}, rules: new HealthRulesEngine() });

    // 3 sample trong cùng phút + 1 sample phút sau.
    projector.ingest(frame(T0, { hr: 60 }));
    projector.ingest(frame(T0 + 20_000, { hr: 70 }));
    projector.ingest(frame(T0 + 40_000, { hr: 80 }));
    projector.ingest(frame(T0 + 70_000, { hr: 90 }));

    const minuteRows = store.rollups({ scope: "ayla-reyes", metric: "heart_rate_bpm", bucket: "1m" });
    expect(minuteRows.length).toBe(2);
    expect(minuteRows[0].bucketStart).toBe(Math.floor(T0 / 60_000) * 60_000);
    expect(minuteRows[0].valueMin).toBe(60);
    expect(minuteRows[0].valueMax).toBe(80);
    expect(minuteRows[0].valueAvg).toBeCloseTo(70, 5);
    expect(minuteRows[0].valueCount).toBe(3);
    expect(minuteRows[1].valueCount).toBe(1);

    const hourly = store.hourlyFromMinute({ scope: "ayla-reyes", metric: "heart_rate_bpm" });
    expect(hourly.length).toBe(1);
    expect(hourly[0].bucket).toBe("1h");
    expect(hourly[0].valueMin).toBe(60);
    expect(hourly[0].valueMax).toBe(90);
    // Weighted: (70*3 + 90*1) / 4 = 75
    expect(hourly[0].valueAvg).toBeCloseTo(75, 5);
    expect(hourly[0].valueCount).toBe(4);
    db.close();
  });

  test("rollup quality_worst upgrades to suspect when any sample is suspect", () => {
    const { db, store } = makeStore("rollup-quality");
    const projector = new HealthProjector({ store, publish: () => {}, rules: new HealthRulesEngine() });
    projector.ingest(frame(T0, { hr: 60 }));
    projector.ingest(frame(T0 + 1000, { hr: 61, quality: "suspect" }));

    const rows = store.rollups({ scope: "ayla-reyes", metric: "heart_rate_bpm", bucket: "1m" });
    expect(rows[0].qualityWorst).toBe("suspect");
    expect(rows[0].valueCount).toBe(2);
    db.close();
  });

  test("mission-scoped env metrics land under MISSION, not on a crew member", () => {
    const { db, store } = makeStore("mission-scope");
    const projector = new HealthProjector({ store, publish: () => {}, rules: new HealthRulesEngine() });
    projector.ingest(frame(T0));

    const mission = store.currentByAstronaut(MISSION_SCOPE);
    expect(mission.map((row) => row.metric).sort()).toEqual(["co2_ppm", "dose_rate_uSv_h", "humidity_pct", "o2_pct", "pressure_kpa", "temperature_c"]);
    const crew = store.currentByAstronaut("ayla-reyes");
    expect(crew.some((row) => row.metric === "co2_ppm")).toBe(false);
    db.close();
  });
});

describe("HealthProjector — facts", () => {
  test("sustained high HR publishes exactly one active fact (dedupe) with crew scope", () => {
    const { db, store } = makeStore("facts");
    const published: HealthFact[] = [];
    const rules = new HealthRulesEngine({ now: () => 1_000_000 });
    const projector = new HealthProjector({ store, rules, publish: (fact) => published.push(fact) });

    // 180 s baseline + 130 s elevated HR (baseline median vẫn ~68).
    for (let i = 0; i < 180; i += 1) projector.ingest(frame(T0 + i * 1000, { hr: 68 }));
    expect(published.length).toBe(0);
    for (let i = 0; i < 130; i += 1) projector.ingest(frame(T0 + 180_000 + i * 1000, { hr: 92 }));

    const active = published.filter((fact) => fact.status === "active");
    expect(active.length).toBe(1);
    expect(active[0].rule).toBe("cardiovascular_anomaly");
    expect(active[0].crewId).toBe("ayla-reyes");
    expect(active[0].category).toBe("cardiovascular");
    expect(active[0].severity).toBe("yellow");
    expect(active[0].sourceMode).toBe("synthetic");
    expect(active[0].evidenceEventIds.length).toBeGreaterThan(0);
    expect(active[0].evidenceEventIds.length).toBeLessThanOrEqual(8);
    db.close();
  });

  test("exercise scenario skips the cardiovascular rule for the exercising crew", () => {
    const { db, store } = makeStore("facts-exercise");
    const published: HealthFact[] = [];
    const rules = new HealthRulesEngine({ now: () => 1_000_000 });
    const projector = new HealthProjector({ store, rules, publish: (fact) => published.push(fact) });
    const status = { scenario: "exercise", exerciseCrewId: "ayla-reyes" } as unknown as Parameters<HealthProjector["ingest"]>[1];

    for (let i = 0; i < 180; i += 1) projector.ingest(frame(T0 + i * 1000, { hr: 142 }), status);
    expect(published.filter((fact) => fact.rule === "cardiovascular_anomaly").length).toBe(0);
    db.close();
  });

  test("mission CO₂ rule fires once from cabin telemetry", () => {
    const { db, store } = makeStore("facts-co2");
    const published: HealthFact[] = [];
    const rules = new HealthRulesEngine({ now: () => 1_000_000 });
    const projector = new HealthProjector({ store, rules, publish: (fact) => published.push(fact) });

    const withCo2 = (atMs: number, co2: number) => [
      ...frame(atMs),
      makeEvent({ deviceId: "co2-analyzer", atMs, payload: { co2_ppm: co2 } }),
    ];
    for (let i = 0; i < 20; i += 1) projector.ingest(withCo2(T0 + i * 1000, 850));
    for (let i = 0; i < 130; i += 1) projector.ingest(withCo2(T0 + 20_000 + i * 1000, 2400));

    const active = published.filter((fact) => fact.rule === "environment_co2_elevated" && fact.status === "active");
    expect(active.length).toBe(1);
    expect(active[0].crewId).toBeUndefined(); // mission-scoped
    expect(active[0].category).toBe("environment");
    db.close();
  });
});
