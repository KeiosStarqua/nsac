import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SimStartOptions } from "../src/sensors/engine";
import type { TelemetryEvent } from "../src/sensors/envelope";

// DB riêng: engine → store → sensorsClient mở connection ngay lúc load module. Set SKY_DB_PATH
// TRƯỚC mọi import src/* (import động) để không bind nhầm vào var/sky.db dùng chung — bun test
// chia sẻ module cache trong một process.
const dir = mkdtempSync(join(tmpdir(), "sky-sim-fast-forward-"));
process.env.SKY_DB_PATH = join(dir, "fast-forward.db");

let SimulationEngine: typeof import("../src/sensors/engine").SimulationEngine;

beforeAll(async () => {
  ({ SimulationEngine } = await import("../src/sensors/engine"));
});

afterAll(() => {
  delete process.env.SKY_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

// PR5 — model time vs emission decoupling + PR1 — deterministic continuation qua export/restore.
// Toàn bộ test dùng store in-memory, không chạm DB.

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

const T0 = Date.UTC(2026, 10, 14, 0, 0, 0);

function stripIds(events: TelemetryEvent[]) {
  return events.map(({ event_id: _eventId, ...rest }) => rest);
}

const deviceEvents = (events: TelemetryEvent[], deviceId: string) => events.filter((e) => e.device_id === deviceId);

function cumulativeDose(events: TelemetryEvent[]): number {
  const cad = deviceEvents(events, "cad");
  const last = cad[cad.length - 1];
  return (last.payload as { cumulative_equivalent_dose_mSv: number }).cumulative_equivalent_dose_mSv;
}

function start(engine: SimulationEngine, extra: Partial<SimStartOptions> = {}) {
  return engine.start({ scenario: "normal", seed: "fast-forward-seed", manual: true, startTimeMs: T0, ...extra });
}

describe("fast-forward emission decoupling", () => {
  test("100× for 3600 sim seconds: cumulative dose matches the 1× run", () => {
    const slow = makeHarness();
    start(slow.engine);
    for (let i = 0; i < 3600; i += 1) slow.engine.tick();

    const fast = makeHarness();
    start(fast.engine, { speed: 100 });
    for (let i = 0; i < 36; i += 1) fast.engine.tick(); // 36 wall ticks × 100 model steps

    expect(fast.engine.simTime()).toBe(slow.engine.simTime());
    expect(cumulativeDose(fast.collected)).toBe(cumulativeDose(slow.collected));
    expect(cumulativeDose(fast.collected)).toBeGreaterThan(0);
    slow.engine.stop();
    fast.engine.stop();
  });

  test("100× persists events per wall second, not per model step", () => {
    const slow = makeHarness();
    start(slow.engine);
    for (let i = 0; i < 3600; i += 1) slow.engine.tick();

    const fast = makeHarness();
    start(fast.engine, { speed: 100 });
    for (let i = 0; i < 36; i += 1) fast.engine.tick();

    const persistedPerWallSecond = fast.collected.length / 36;
    const oneXPerSimSecond = slow.collected.length / 3600;
    // Số event mỗi frame ≈ số event mỗi giây sim của 1× (cùng cadence thiết bị).
    expect(persistedPerWallSecond).toBeGreaterThan(oneXPerSimSecond * 0.8);
    expect(persistedPerWallSecond).toBeLessThan(oneXPerSimSecond * 1.2);
    // Không phải 100× số event (bound rõ ràng).
    expect(fast.collected.length).toBeLessThan(slow.collected.length / 50);
    slow.engine.stop();
    fast.engine.stop();
  });

  test("10× advances 10 model steps per tick and keeps dose continuity", () => {
    const a = makeHarness();
    start(a.engine, { scenario: "radiation_event" });
    for (let i = 0; i < 600; i += 1) a.engine.tick();

    const b = makeHarness();
    start(b.engine, { scenario: "radiation_event", speed: 10 });
    for (let i = 0; i < 60; i += 1) b.engine.tick();

    expect(b.engine.simTime()).toBe(a.engine.simTime());
    expect(cumulativeDose(b.collected)).toBe(cumulativeDose(a.collected));
    a.engine.stop();
    b.engine.stop();
  });

  test("1× emits one frame per tick (byte-compatible with v1 cadence)", () => {
    const h = makeHarness();
    start(h.engine);
    h.engine.tick();
    // Frame 1 s: biomonitor 6 crew, pulse-ox 6, respiratory 6, cad 6, thermo 6, bp-ecg 6, env 5, cans 1.
    expect(h.collected.length).toBeGreaterThanOrEqual(40);
    expect(h.collected.length).toBeLessThanOrEqual(48);
    h.engine.stop();
  });

  test("real timer: speed 10 advances ~10 sim s per wall second and persists ~1 frame/s", async () => {
    const h = makeHarness();
    h.engine.start({ scenario: "normal", seed: "timer-seed", speed: 10 }); // KHÔNG manual
    const startedWall = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 2100));
    h.engine.stop();
    const wallSeconds = (Date.now() - startedWall) / 1000;
    const startedAtMs = h.engine.exportState().startedAtMs!;
    const simSeconds = (h.engine.simTime() - startedAtMs) / 1000;
    const ratio = simSeconds / wallSeconds;
    // 10× ± dung sai timer của CI, nhưng KHÔNG phải 100× (speed² bug).
    expect(ratio).toBeGreaterThan(5);
    expect(ratio).toBeLessThan(15);
    // Frame persist ≈ 1/wall giây (không phải 10): ~30 event/frame.
    const frames = h.collected.length / 30;
    expect(frames).toBeGreaterThan(0.5);
    expect(frames).toBeLessThan(wallSeconds * 3);
  });
});

describe("deterministic continuation across export/restore", () => {
  test("restore into a NEW engine reproduces the uninterrupted ticks", () => {
    const original = makeHarness();
    original.engine.start({ scenario: "co2_accumulation", seed: "restore-seed", manual: true, startTimeMs: T0 });
    for (let i = 0; i < 100; i += 1) original.engine.tick();
    const state = original.engine.exportState();

    // Engine B start với cấu hình khác rồi restore state của A.
    const restored = makeHarness();
    restored.engine.start({ scenario: "exercise", seed: "other-seed", manual: true, startTimeMs: T0 + 999_000 });
    restored.engine.tick(); // tiến RNG đi chỗ khác trước khi restore
    restored.engine.restoreState(state, { manual: true });
    restored.collected.length = 0;

    expect(restored.engine.exportState()).toEqual(state);

    const mark = original.collected.length;
    for (let i = 0; i < 50; i += 1) original.engine.tick();
    for (let i = 0; i < 50; i += 1) restored.engine.tick();

    const uninterrupted = original.collected.slice(mark);
    const continued = restored.collected;
    expect(stripIds(continued)).toEqual(stripIds(uninterrupted));
    expect(continued.length).toBeGreaterThan(0);
    original.engine.stop();
    restored.engine.stop();
  });

  test("restore keeps gaussian spare + mulberry state (no drift over 600 ticks)", () => {
    const a = makeHarness();
    a.engine.start({ scenario: "anomaly_symptom", seed: "spare-seed", manual: true, startTimeMs: T0 });
    for (let i = 0; i < 33; i += 1) a.engine.tick(); // lẻ tick ⇒ spare gần chắc chắn đang set
    const state = a.engine.exportState();

    const b = makeHarness();
    b.engine.start({ scenario: "normal", seed: "spare-seed", manual: true, startTimeMs: T0 });
    b.engine.restoreState(state, { manual: true });
    b.collected.length = 0;

    const mark = a.collected.length;
    for (let i = 0; i < 600; i += 1) a.engine.tick();
    for (let i = 0; i < 600; i += 1) b.engine.tick();

    expect(stripIds(b.collected)).toEqual(stripIds(a.collected.slice(mark)));
    a.engine.stop();
    b.engine.stop();
  });
});

describe("scenario switch mid-run (PR5)", () => {
  test("switch restarts scenario envelopes without resetting HR walk / mission env / RNG", () => {
    const h = makeHarness();
    h.engine.start({ scenario: "normal", seed: "switch-seed", manual: true, startTimeMs: T0 });
    for (let i = 0; i < 300; i += 1) h.engine.tick();
    const before = h.engine.exportState();
    const hrBefore = before.crew["ayla-reyes"].hr;

    const status = h.engine.setScenario("co2_accumulation", "lena-fischer");
    expect(status.scenario).toBe("co2_accumulation");
    const after = h.engine.exportState();

    expect(after.tickIndex).toBe(before.tickIndex);
    expect(after.scenarioTick).toBe(before.tickIndex);
    expect(after.rng).toEqual(before.rng); // không draw gì khi switch
    expect(after.crew).toEqual(before.crew); // HR walk không reset
    expect(after.mission.pressure).toBe(before.mission.pressure); // env không reset
    expect(after.exerciseCrewId).toBe("lena-fischer");

    // Envelope CO₂ đếm lại từ 0 ⇒ vài giây đầu vẫn quanh baseline, không nhảy tới target.
    h.collected.length = 0;
    h.engine.tick();
    const firstCo2 = (deviceEvents(h.collected, "co2-analyzer")[0].payload as { co2_ppm: number }).co2_ppm;
    expect(firstCo2).toBeLessThan(1200);

    // HR sau switch vẫn quanh giá trị trước (walk tiếp, không bị reset về baseline).
    const hrAfter = h.engine.exportState().crew["ayla-reyes"].hr;
    expect(Math.abs(hrAfter - hrBefore)).toBeLessThan(8);

    // Sau 270 s sim, envelope CO₂ (τ=120 s) dẫn tới > 1500 ppm.
    for (let i = 0; i < 270; i += 1) h.engine.tick();
    const co2s = deviceEvents(h.collected, "co2-analyzer");
    const last = (co2s[co2s.length - 1].payload as { co2_ppm: number }).co2_ppm;
    expect(last).toBeGreaterThan(1500);
    h.engine.stop();
  });

  test("same seed + same switch ⇒ identical events (deterministic)", () => {
    const run = () => {
      const h = makeHarness();
      h.engine.start({ scenario: "normal", seed: "switch-seed", manual: true, startTimeMs: T0 });
      for (let i = 0; i < 120; i += 1) h.engine.tick();
      h.engine.setScenario("radiation_event");
      for (let i = 0; i < 60; i += 1) h.engine.tick();
      h.engine.stop();
      return stripIds(h.collected);
    };
    expect(run()).toEqual(run());
  });

  test("switching to exercise targets the given crew and restarts elapsed_s", () => {
    const h = makeHarness();
    h.engine.start({ scenario: "normal", seed: "switch-ex", manual: true, startTimeMs: T0 });
    for (let i = 0; i < 90; i += 1) h.engine.tick();
    h.engine.setScenario("exercise", "yuki-tanaka");
    h.collected.length = 0;
    h.engine.tick();
    h.engine.tick();
    const ergo = deviceEvents(h.collected, "ergometer");
    expect(ergo.length).toBeGreaterThan(0);
    expect(ergo[0].crew_id).toBe("yuki-tanaka");
    expect((ergo[0].payload as { elapsed_s: number }).elapsed_s).toBe(0);
    h.engine.stop();
  });
});
