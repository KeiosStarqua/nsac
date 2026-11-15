import type { Database } from "bun:sqlite";
import { sensorsSqlite } from "../sensorsClient";

// Durable simulator session (SPEC §14). Một row / mission; runtime checkpoint ghi UPSERT.
// JSON columns giữ nguyên dạng TEXT ở boundary repo — `sensors/runtime.ts` serialize state engine.

export type SimSessionStatus = "running" | "paused" | "stopped";

export interface SimSessionRecord {
  missionId: string;
  runId: string;
  scenario: string;
  speed: number;
  seed: string;
  status: SimSessionStatus;
  startedAtMs: number | null;
  simTimeMs: number;
  tickIndex: number;
  scenarioTick: number;
  /** JSON `Record<deviceId, sequence>`. */
  sequences: string;
  /** JSON `Record<crewId, CrewState>`. */
  crewState: string;
  /** JSON mission env + scenario peeks (radiation peak, CANS multiplier, fault, stuck payloads…). */
  missionState: string;
  /** JSON `{ a: number, spare: number | null }`. */
  rngState: string;
  updatedAt: number;
}

export interface SimSessionStore {
  get(missionId: string): SimSessionRecord | null;
  upsert(record: SimSessionRecord): void;
  remove(missionId: string): void;
}

interface SimSessionDbRow {
  mission_id: string;
  run_id: string;
  scenario: string;
  speed: number;
  seed: string;
  status: string;
  started_at_ms: number | null;
  sim_time_ms: number;
  tick_index: number;
  scenario_tick: number;
  sequences: string;
  crew_state: string;
  mission_state: string;
  rng_state: string;
  updated_at: number;
}

function toRecord(row: SimSessionDbRow): SimSessionRecord {
  return {
    missionId: row.mission_id,
    runId: row.run_id,
    scenario: row.scenario,
    speed: row.speed,
    seed: row.seed,
    status: row.status as SimSessionStatus,
    startedAtMs: row.started_at_ms,
    simTimeMs: row.sim_time_ms,
    tickIndex: row.tick_index,
    scenarioTick: row.scenario_tick,
    sequences: row.sequences,
    crewState: row.crew_state,
    missionState: row.mission_state,
    rngState: row.rng_state,
    updatedAt: row.updated_at,
  };
}

/** Implementation trên một handle bất kỳ — test dựng `new Database(tmp)` + `ensureSimSessionSchema`. */
export class SqliteSimSessionStore implements SimSessionStore {
  constructor(private readonly sqlite: Database) {}

  get(missionId: string): SimSessionRecord | null {
    const row = this.sqlite
      .query("SELECT * FROM sim_sessions WHERE mission_id = ?")
      .get(missionId) as SimSessionDbRow | null;
    return row ? toRecord(row) : null;
  }

  upsert(record: SimSessionRecord): void {
    this.sqlite
      .query(
        `INSERT INTO sim_sessions (
           mission_id, run_id, scenario, speed, seed, status, started_at_ms, sim_time_ms,
           tick_index, scenario_tick, sequences, crew_state, mission_state, rng_state, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(mission_id) DO UPDATE SET
           run_id = excluded.run_id,
           scenario = excluded.scenario,
           speed = excluded.speed,
           seed = excluded.seed,
           status = excluded.status,
           started_at_ms = excluded.started_at_ms,
           sim_time_ms = excluded.sim_time_ms,
           tick_index = excluded.tick_index,
           scenario_tick = excluded.scenario_tick,
           sequences = excluded.sequences,
           crew_state = excluded.crew_state,
           mission_state = excluded.mission_state,
           rng_state = excluded.rng_state,
           updated_at = excluded.updated_at`,
      )
      .run(
        record.missionId,
        record.runId,
        record.scenario,
        record.speed,
        record.seed,
        record.status,
        record.startedAtMs,
        record.simTimeMs,
        record.tickIndex,
        record.scenarioTick,
        record.sequences,
        record.crewState,
        record.missionState,
        record.rngState,
        record.updatedAt,
      );
  }

  remove(missionId: string): void {
    this.sqlite.query("DELETE FROM sim_sessions WHERE mission_id = ?").run(missionId);
  }
}

/** Singleton dùng bởi runtime (connection SENSORS). */
export const simSessionsRepo = new SqliteSimSessionStore(sensorsSqlite);
