import { describe, expect, test } from "bun:test";
import { SimulationEngine, type SimStartOptions, type Scenario } from "../src/sensors/engine";
import type { TelemetryEvent } from "../src/sensors/envelope";

// In-memory collector — engine không chạm DB trong tests này.
function makeHarness() {
  const collected: TelemetryEvent[] = [];
  const store = {
    insertBatch(events: TelemetryEvent[]) {
      collected.push(...events);
    },
    recent() {
      return [];
    },
    maxSequence() {
      return 0;
    },
    deleteByMission() {
      const n = collected.length;
      collected.length = 0;
      return n;
    },
  };
  const engine = new SimulationEngine({ store });
  return { engine, collected };
}

const T0 = Date.UTC(2026, 10, 14, 0, 0, 0); // start cố định — received_at deterministic

function run(engine: SimulationEngine, collected: TelemetryEvent[], ticks: number) {
  void collected;
  for (let i = 0; i < ticks; i += 1) engine.tick();
}

function start(engine: SimulationEngine, scenario: Scenario, extra: Partial<SimStartOptions> = {}) {
  return engine.start({ scenario, seed: "engine-test-seed", manual: true, startTimeMs: T0, ...extra });
}

/** Determinism so sánh — bỏ event_id (uuid ngẫu nhiên), mọi thứ khác phải khớp. */
function stripIds(events: TelemetryEvent[]) {
  return events.map(({ event_id: _eventId, ...rest }) => rest);
}

const deviceEvents = (events: TelemetryEvent[], deviceId: string) => events.filter((e) => e.device_id === deviceId);

describe("simulation engine", () => {
  test("same seed + scenario ⇒ identical sequence of events", () => {
    const a = makeHarness();
    const b = makeHarness();
    start(a.engine, "normal");
    start(b.engine, "normal");
    run(a.engine, a.collected, 40);
    run(b.engine, b.collected, 40);
    expect(a.collected.length).toBeGreaterThan(0);
    expect(stripIds(a.collected)).toEqual(stripIds(b.collected));
    // received_at cũng deterministic (sim clock) — kiểm tra tường minh.
    for (let i = 0; i < a.collected.length; i += 1) {
      expect(a.collected[i].received_at).toBe(b.collected[i].received_at);
      expect(a.collected[i].observed_at).toBe(b.collected[i].observed_at);
    }
    a.engine.stop();
    b.engine.stop();
  });

  test("different seed ⇒ different payloads (sanity)", () => {
    const a = makeHarness();
    const b = makeHarness();
    a.engine.start({ scenario: "normal", seed: "seed-a", manual: true, startTimeMs: T0 });
    b.engine.start({ scenario: "normal", seed: "seed-b", manual: true, startTimeMs: T0 });
    run(a.engine, a.collected, 5);
    run(b.engine, b.collected, 5);
    expect(JSON.stringify(stripIds(a.collected))).not.toBe(JSON.stringify(stripIds(b.collected)));
    a.engine.stop();
    b.engine.stop();
  });

  test("sequence starts at 1 on a fresh DB", () => {
    const h = makeHarness();
    start(h.engine, "normal");
    h.engine.tick();
    expect(Math.min(...h.collected.map((e) => e.sequence))).toBe(1);
    h.engine.stop();
  });

  test("sequence resumes from store maxSequence on start", () => {
    const collected: TelemetryEvent[] = [];
    const store = {
      insertBatch(events: TelemetryEvent[]) {
        collected.push(...events);
      },
      recent() {
        return [];
      },
      maxSequence() {
        return 41;
      },
      deleteByMission() {
        return 0;
      },
    };
    const engine = new SimulationEngine({ store });
    engine.start({ scenario: "normal", seed: "seq-seed", manual: true, startTimeMs: T0 });
    engine.tick();
    expect(Math.min(...collected.map((e) => e.sequence))).toBe(42);
    engine.stop();
  });

  test("co2_accumulation ramps co2_ppm past 1500 ppm", () => {
    const h = makeHarness();
    start(h.engine, "co2_accumulation");
    run(h.engine, h.collected, 270); // t = 0..269 s (τ=120 s, target 2500 ppm demo)
    const co2Events = deviceEvents(h.collected, "co2-analyzer");
    const last = co2Events[co2Events.length - 1].payload as { co2_ppm: number };
    expect(last.co2_ppm).toBeGreaterThan(1500);
    h.engine.stop();
  });

  test("radiation_event spikes CAD dose_rate above 5 µSv/h", () => {
    const h = makeHarness();
    start(h.engine, "radiation_event");
    run(h.engine, h.collected, 10);
    const cad = deviceEvents(h.collected, "cad");
    const maxDose = Math.max(...cad.map((e) => (e.payload as { dose_rate_uSv_h: number }).dose_rate_uSv_h));
    expect(maxDose).toBeGreaterThan(5);
    // CANS baseline ×6–12 ở đỉnh — event t=0 phải có neutron_count > 12 (CANS tuning).
    const cans = deviceEvents(h.collected, "cans");
    expect(cans.length).toBeGreaterThan(0);
    expect((cans[0].payload as { neutron_count: number }).neutron_count).toBeGreaterThan(12);
    h.engine.stop();
  });

  test("exercise raises HR above 100 bpm within the session", () => {
    const h = makeHarness();
    start(h.engine, "exercise", { crewId: "ayla-reyes" });
    run(h.engine, h.collected, 120); // t = 0..119 s, τ≈45 s → gần 142
    const hr = deviceEvents(h.collected, "biomonitor")
      .filter((e) => e.crew_id === "ayla-reyes")
      .map((e) => (e.payload as { heart_rate_bpm: number }).heart_rate_bpm);
    const meanLast10 = hr.slice(-10).reduce((a, b) => a + b, 0) / 10;
    expect(meanLast10).toBeGreaterThan(100);
    // Ergometer session chạy và có power trong fixture range (±8 quanh 140).
    const ergo = deviceEvents(h.collected, "ergometer");
    expect(ergo.length).toBeGreaterThan(0);
    const powers = ergo.map((e) => (e.payload as { power_w: number }).power_w);
    expect(Math.max(...powers)).toBeGreaterThan(100);
    h.engine.stop();
  });

  test("sensor_fault dropout ⇒ sequence gap + quality ≠ good", () => {
    const h = makeHarness();
    start(h.engine, "sensor_fault", { fault: { deviceId: "biomonitor", kind: "dropout", p: 0.5 } });
    run(h.engine, h.collected, 120);
    const biomonitor = deviceEvents(h.collected, "biomonitor");
    const sequences = biomonitor.map((e) => e.sequence);
    const hasGap = sequences.some((s, i) => i > 0 && s - sequences[i - 1] > 1);
    expect(hasGap).toBe(true);
    expect(biomonitor.every((e) => e.quality.status !== "good")).toBe(true);
    h.engine.stop();
  });

  test("sensor_fault stuck ⇒ payload holds the stuck value", () => {
    const h = makeHarness();
    start(h.engine, "sensor_fault", { fault: { deviceId: "biomonitor", kind: "stuck", stuckValue: 77 } });
    run(h.engine, h.collected, 30);
    const biomonitor = deviceEvents(h.collected, "biomonitor");
    expect(biomonitor.length).toBeGreaterThan(0);
    for (const ev of biomonitor) {
      expect((ev.payload as { heart_rate_bpm: number }).heart_rate_bpm).toBe(77);
      expect(ev.quality.status).toBe("suspect");
    }
    // Toàn bộ payload bị freeze — mọi field số đồng nhất giữa các event.
    const first = JSON.stringify(biomonitor[0].payload);
    expect(biomonitor.every((e) => JSON.stringify({ ...(e.payload as Record<string, unknown>), heart_rate_bpm: 77 }) === first)).toBe(true);
    h.engine.stop();
  });

  test("sensor_fault drift ⇒ offset grows linearly, quality suspect", () => {
    const h = makeHarness();
    start(h.engine, "sensor_fault", { fault: { deviceId: "biomonitor", kind: "drift", driftPerMin: 3 } });
    run(h.engine, h.collected, 120); // 2 phút sim → offset ≈ +6 ở cuối
    const hr = deviceEvents(h.collected, "biomonitor").map(
      (e) => (e.payload as { heart_rate_bpm: number }).heart_rate_bpm,
    );
    expect(hr[hr.length - 1]).toBeGreaterThan(hr[0] + 3);
    expect(deviceEvents(h.collected, "biomonitor").every((e) => e.quality.status === "suspect")).toBe(true);
    h.engine.stop();
  });

  test("comm_loss ⇒ received_at skewed ahead of observed_at, quality suspect", () => {
    const h = makeHarness();
    start(h.engine, "comm_loss");
    run(h.engine, h.collected, 10);
    expect(h.collected.length).toBeGreaterThan(0);
    for (const ev of h.collected) {
      expect(Date.parse(ev.received_at)).toBeGreaterThan(Date.parse(ev.observed_at));
      const skewMs = Date.parse(ev.received_at) - Date.parse(ev.observed_at);
      expect(skewMs).toBeGreaterThanOrEqual(600_000); // +10–15 min sim
      expect(skewMs).toBeLessThanOrEqual(900_000);
      expect(ev.quality.status).toBe("suspect");
    }
    h.engine.stop();
  });

  test("anomaly_symptom elevates one crew member relative to another", () => {
    const full = makeHarness();
    start(full.engine, "anomaly_symptom"); // target = ayla-reyes (mặc định), roster đầy đủ
    run(full.engine, full.collected, 400);
    const meanTail = (events: TelemetryEvent[], crewId: string) => {
      const hr = deviceEvents(events, "biomonitor")
        .filter((e) => e.crew_id === crewId)
        .map((e) => (e.payload as { heart_rate_bpm: number }).heart_rate_bpm)
        .slice(-30);
      return hr.reduce((a, b) => a + b, 0) / hr.length;
    };
    const ayla = meanTail(full.collected, "ayla-reyes");
    const dae = meanTail(full.collected, "dae-jung-park");
    expect(ayla - dae).toBeGreaterThan(3); // HR +12 mong đợi, onset τ≈300 s
    full.engine.stop();
  });

  test("all emitted events are synthetic with stable shape", () => {
    const h = makeHarness();
    start(h.engine, "normal");
    run(h.engine, h.collected, 65); // bao trọn mốc %5 và %60
    for (const ev of h.collected) {
      expect(ev.source.mode).toBe("synthetic");
      expect(ev.schema_version).toBe("1.0");
      expect(ev.sequence).toBeGreaterThanOrEqual(1);
      expect(["good", "suspect", "invalid"]).toContain(ev.quality.status);
    }
    // Có đủ 9 device kinds trong 65 tick (bp-ecg và cans ở tick 0 và 60).
    const deviceIds = new Set(h.collected.map((e) => e.device_id));
    for (const id of ["biomonitor", "thermo-mini", "bp-ecg", "pulse-oximeter", "respiratory-assessment", "o2-analyzer", "co2-analyzer", "pressure-sensor", "temperature-sensor", "humidity-sensor", "cad", "cans"]) {
      expect(deviceIds.has(id)).toBe(true);
    }
    h.engine.stop();
  });
});
