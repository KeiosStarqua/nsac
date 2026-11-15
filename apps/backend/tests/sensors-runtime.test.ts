import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TelemetryEvent } from "../src/sensors/envelope";

const dir = mkdtempSync(join(tmpdir(), "sky-sim-runtime-test-"));
process.env.SKY_DB_PATH = join(dir, "runtime-singleton.db");

type EngineModule = typeof import("../src/sensors/engine");
type SensorsClientModule = typeof import("../src/db/sensorsClient");
type SessionRepoModule = typeof import("../src/db/repositories/simSessions");
type RuntimeModule = typeof import("../src/sensors/runtime");
type RetentionModule = typeof import("../src/sensors/retention");

let SimulationEngine: EngineModule["SimulationEngine"];
let ensureSimSessionSchema: SensorsClientModule["ensureSimSessionSchema"];
let ensureTelemetrySchema: SensorsClientModule["ensureTelemetrySchema"];
let SqliteSimSessionStore: SessionRepoModule["SqliteSimSessionStore"];
let SimulationRuntime: RuntimeModule["SimulationRuntime"];
let stateFromSessionRecord: RuntimeModule["stateFromSessionRecord"];
let SIM_MISSION_ID: RuntimeModule["SIM_MISSION_ID"];
let CHECKPOINT_EVERY_TICKS: RuntimeModule["CHECKPOINT_EVERY_TICKS"];
let pruneTelemetry: RetentionModule["pruneTelemetry"];

beforeAll(async () => {
  // Import động: các module này mở connection SENSORS lúc load. DB riêng bằng handle inject,
  // không chạm singleton — env chỉ để connection singleton không trỏ vào var/sky.db.
  ({ SimulationEngine } = await import("../src/sensors/engine"));
  ({ ensureSimSessionSchema, ensureTelemetrySchema } = await import("../src/db/sensorsClient"));
  ({ SqliteSimSessionStore } = await import("../src/db/repositories/simSessions"));
  ({ SimulationRuntime, stateFromSessionRecord, SIM_MISSION_ID, CHECKPOINT_EVERY_TICKS } = await import("../src/sensors/runtime"));
  ({ pruneTelemetry } = await import("../src/sensors/retention"));
});

// PR1 — durable session + PR5 — retention.

afterAll(() => {
  delete process.env.SKY_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

const T0 = Date.UTC(2026, 10, 14, 0, 0, 0);
const noop = () => {};

function makeEngine() {
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
      return 0;
    },
  };
  return { engine: new SimulationEngine({ store }), collected };
}

function makeSessions(name: string) {
  const db = new Database(join(dir, `${name}.db`));
  db.exec("PRAGMA journal_mode = WAL;");
  ensureSimSessionSchema(db);
  return new SqliteSimSessionStore(db);
}

function makeRuntime(name: string, opts: { autostart?: boolean } = {}) {
  const { engine, collected } = makeEngine();
  const sessions = makeSessions(name);
  const logs: string[] = [];
  const runtime = new SimulationRuntime({
    engine,
    sessions,
    retention: false,
    signals: false,
    manual: true,
    autostart: () => opts.autostart ?? true,
    log: (line) => logs.push(line),
    newRunId: () => `run-${name}`,
  });
  return { runtime, engine, collected, sessions, logs };
}

function stripIds(events: TelemetryEvent[]) {
  return events.map(({ event_id: _id, ...rest }) => rest);
}

describe("simulation runtime — autostart", () => {
  test("SKY_SIM_AUTOSTART off ⇒ no producer, log line", () => {
    const h = makeRuntime("autostart-off", { autostart: false });
    h.runtime.boot();
    expect(h.engine.isRunning()).toBe(false);
    expect(h.logs).toContain("[sim] autostart disabled");
    expect(h.sessions.get(SIM_MISSION_ID)).toBeNull();
  });

  test("autostart starts SIM-001 and writes a running checkpoint", () => {
    const h = makeRuntime("autostart-on");
    h.runtime.boot();
    expect(h.engine.isRunning()).toBe(true);
    const session = h.sessions.get(SIM_MISSION_ID);
    expect(session).not.toBeNull();
    expect(session!.status).toBe("running");
    expect(session!.scenario).toBe("normal");
    expect(session!.seed).toBe("sky-sim-1");
    expect(session!.runId).toBe("run-autostart-on");
    h.runtime.shutdown();
  });

  test("no second producer when the engine already runs", () => {
    const h = makeRuntime("already-running");
    h.engine.start({ scenario: "exercise", speed: 10, missionId: SIM_MISSION_ID, seed: "manual", manual: true, startTimeMs: T0 });
    h.runtime.boot();
    expect(h.engine.status().scenario).toBe("exercise"); // không bị autostart ghi đè
    expect(h.logs.some((line) => line.includes("already running"))).toBe(true);
    h.engine.stop();
  });

  test("checkpoint every 60 ticks", () => {
    const h = makeRuntime("checkpoint-periodic");
    h.runtime.boot();
    for (let i = 0; i < CHECKPOINT_EVERY_TICKS * 2 + 5; i += 1) h.engine.tick();
    const session = h.sessions.get(SIM_MISSION_ID);
    expect(session).not.toBeNull();
    expect(session!.tickIndex).toBe(CHECKPOINT_EVERY_TICKS * 2);
    h.runtime.shutdown();
  });

  test("checkpoint on scenario change", () => {
    const h = makeRuntime("checkpoint-scenario");
    h.runtime.boot();
    for (let i = 0; i < 10; i += 1) h.engine.tick();
    h.engine.setScenario("co2_accumulation");
    const session = h.sessions.get(SIM_MISSION_ID)!;
    expect(session.scenario).toBe("co2_accumulation");
    expect(session.tickIndex).toBe(10);
    expect(session.scenarioTick).toBe(10);
    h.runtime.shutdown();
  });
});

describe("simulation runtime — restart recovery", () => {
  test("boot restores a paused session and continues byte-identically", () => {
    const first = makeRuntime("restart-a");
    first.runtime.boot();
    for (let i = 0; i < 130; i += 1) first.engine.tick();
    first.runtime.shutdown(); // checkpoint "paused" + stop

    const paused = first.sessions.get(SIM_MISSION_ID)!;
    expect(paused.status).toBe("paused");
    expect(paused.tickIndex).toBe(130); // shutdown checkpoint = state hiện tại
    expect(first.engine.isRunning()).toBe(false);

    // Process mới: cùng DB, engine mới, runtime mới → restore.
    const second = makeRuntime("restart-a");
    second.runtime.boot();
    expect(second.engine.isRunning()).toBe(true);
    const restored = second.engine.exportState();
    expect(restored.tickIndex).toBe(130);
    expect(restored.seed).toBe("sky-sim-1");

    // Tick tiếp từ 130 → so với engine không gián đoạn (restore state rồi tick 30).
    const reference = makeEngine();
    reference.engine.restoreState(stateFromSessionRecord(paused), { manual: true });
    reference.engine.setHooks(null);
    for (let i = 0; i < 30; i += 1) second.engine.tick();
    for (let i = 0; i < 30; i += 1) reference.engine.tick();
    expect(stripIds(second.collected)).toEqual(stripIds(reference.collected));
    second.runtime.shutdown();
  });

  test("a stopped session is NOT restored at boot (fresh mission instead)", () => {
    const h = makeRuntime("stopped");
    h.runtime.boot();
    for (let i = 0; i < 5; i += 1) h.engine.tick();
    h.engine.stop(); // stop qua API ⇒ status "stopped"
    expect(h.sessions.get(SIM_MISSION_ID)!.status).toBe("stopped");

    const next = makeRuntime("stopped");
    next.runtime.boot();
    expect(next.engine.exportState().tickIndex).toBe(0); // start mới, không restore
    next.runtime.shutdown();
  });

  test("observable engine state round-trips through the session row", () => {
    const h = makeRuntime("roundtrip");
    h.runtime.boot();
    for (let i = 0; i < 61; i += 1) h.engine.tick();
    h.runtime.checkpoint("running");
    const row = h.sessions.get(SIM_MISSION_ID)!;
    const state = stateFromSessionRecord(row);
    expect(state).toEqual(h.engine.exportState());
    h.runtime.shutdown();
  });
});

describe("telemetry retention (PR5)", () => {
  function insertRow(db: Database, id: string, receivedAt: string) {
    db.query(
      `INSERT INTO telemetry_events (event_id, mission_id, crew_id, device_id, device_type, location_id,
         source_mode, dataset_id, observed_at, received_at, sequence, quality_status, payload)
       VALUES (?, 'SIM-001', NULL, 'biomonitor', 'biomonitor', 'HAB-01', 'synthetic', NULL, ?, ?, 1, 'good', '{}')`,
    ).run(id, receivedAt, receivedAt);
  }

  test("prunes rows older than SKY_TELEMETRY_RETENTION_DAYS", () => {
    const db = new Database(join(dir, "retention-age.db"));
    ensureTelemetrySchema(db);
    const now = Date.UTC(2026, 10, 15, 12, 0, 0);
    insertRow(db, "old-1", new Date(now - 5 * 86_400_000).toISOString());
    insertRow(db, "old-2", new Date(now - 4 * 86_400_000).toISOString());
    insertRow(db, "fresh-1", new Date(now - 3_600_000).toISOString());
    insertRow(db, "fresh-2", new Date(now - 60_000).toISOString());

    const logs: string[] = [];
    const result = pruneTelemetry({ db, retentionDays: 3, maxRows: 1_000_000, now, log: (l) => logs.push(l) });
    expect(result.deleted).toBe(2);
    expect(result.remaining).toBe(2);
    expect(logs).toEqual(["[telemetry] pruned 2 rows"]);
    const left = db.query("SELECT event_id FROM telemetry_events ORDER BY event_id").all() as Array<{ event_id: string }>;
    expect(left.map((r) => r.event_id)).toEqual(["fresh-1", "fresh-2"]);
    db.close();
  });

  test("caps total rows at SKY_TELEMETRY_MAX_ROWS by dropping the oldest", () => {
    const db = new Database(join(dir, "retention-cap.db"));
    ensureTelemetrySchema(db);
    const now = Date.UTC(2026, 10, 15, 12, 0, 0);
    for (let i = 0; i < 20; i += 1) {
      insertRow(db, `row-${String(i).padStart(2, "0")}`, new Date(now - (20 - i) * 1000).toISOString());
    }
    const logs: string[] = [];
    const result = pruneTelemetry({ db, retentionDays: 30, maxRows: 12, now, log: (l) => logs.push(l) });
    expect(result.remaining).toBe(12);
    expect(result.deleted).toBe(8);
    const left = db.query("SELECT event_id FROM telemetry_events ORDER BY received_at ASC").all() as Array<{ event_id: string }>;
    expect(left[0].event_id).toBe("row-08"); // 8 row cũ nhất đã bị xoá
    expect(left[left.length - 1].event_id).toBe("row-19");
    db.close();
  });

  test("prune of an empty/healthy table is a no-op (no log line)", () => {
    const db = new Database(join(dir, "retention-noop.db"));
    ensureTelemetrySchema(db);
    const now = Date.UTC(2026, 10, 15, 12, 0, 0);
    insertRow(db, "keep-1", new Date(now - 1000).toISOString());
    const logs: string[] = [];
    const result = pruneTelemetry({ db, retentionDays: 3, maxRows: 10, now, log: (l) => logs.push(l) });
    expect(result).toEqual({ deleted: 0, remaining: 1 });
    expect(logs).toEqual([]);
    db.close();
  });
});
