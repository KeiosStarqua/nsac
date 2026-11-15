// Continuous simulation runtime (SPEC §14 "Continuous runtime (v2)") — PR1.
//
// Trước v2 simulator chỉ chạy khi có POST /api/sensors/sim/start ⇒ production luôn
// `{ running:false }` và telemetry_events rỗng. Runtime này:
//   1. autostart mission SIM-001 (env SKY_SIM_AUTOSTART=1; tắt = hành vi v1),
//   2. checkpoint state engine vào `sim_sessions` (60 tick / stop / scenario change),
//   3. restore từ checkpoint khi process restart (clock, RNG, sequences, crew/mission state),
//   4. retention telemetry (boot + mỗi giờ),
//   5. SIGINT/SIGTERM → checkpoint "paused" rồi mới stop (không corrupt DB).
//
// Nguyên tắc: exactly ONE producer per mission — nếu engine đã chạy thì runtime chỉ gắn hook
// và không start lần hai. Best-effort: lỗi checkpoint chỉ log, không bao giờ làm chết sim.

import type { SimulationEngine, SimEngineState, SimStatus } from "./engine";
import { simulationEngine } from "./engine";
import {
  simSessionsRepo,
  type SimSessionRecord,
  type SimSessionStatus,
  type SimSessionStore,
} from "../db/repositories/simSessions";
import { startTelemetryRetention } from "./retention";

export const SIM_MISSION_ID = "SIM-001";
export const SIM_DEFAULT_SEED = "sky-sim-1";
export const CHECKPOINT_EVERY_TICKS = 60;

/** Mission state JSON: mission env + mọi peek engine cần để tick tiếp giống hệt. */
interface MissionStateBundle {
  mission: SimEngineState["mission"];
  crewIds: string[];
  exerciseCrewId: string;
  anomalyCrewId: string;
  radiationPeakUSvH: number;
  cansMultiplier: number;
  fault: SimEngineState["fault"];
  stuckPayloads: SimEngineState["stuckPayloads"];
}

export function sessionRecordFromState(
  state: SimEngineState,
  opts: { runId: string; status: SimSessionStatus; updatedAt: number },
): SimSessionRecord {
  const bundle: MissionStateBundle = {
    mission: state.mission,
    crewIds: state.crewIds,
    exerciseCrewId: state.exerciseCrewId,
    anomalyCrewId: state.anomalyCrewId,
    radiationPeakUSvH: state.radiationPeakUSvH,
    cansMultiplier: state.cansMultiplier,
    fault: state.fault,
    stuckPayloads: state.stuckPayloads,
  };
  const speed = state.speed === 10 || state.speed === 100 ? state.speed : 1;
  return {
    missionId: state.missionId,
    runId: opts.runId,
    scenario: state.scenario,
    speed,
    seed: state.seed,
    status: opts.status,
    startedAtMs: state.startedAtMs,
    simTimeMs: state.simTimeMs,
    tickIndex: state.tickIndex,
    scenarioTick: state.scenarioTick,
    sequences: JSON.stringify(state.sequences),
    crewState: JSON.stringify(state.crew),
    missionState: JSON.stringify(bundle),
    rngState: JSON.stringify(state.rng),
    updatedAt: opts.updatedAt,
  };
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    const value = JSON.parse(text);
    return value === null || value === undefined ? fallback : (value as T);
  } catch {
    return fallback;
  }
}

export function stateFromSessionRecord(record: SimSessionRecord): SimEngineState {
  const bundle = parseJson<Partial<MissionStateBundle>>(record.missionState, {});
  const rng = parseJson<{ a: number; spare: number | null }>(record.rngState, { a: 0, spare: null });
  const speed = record.speed === 10 || record.speed === 100 ? record.speed : 1;
  return {
    scenario: record.scenario as SimEngineState["scenario"],
    speed,
    missionId: record.missionId,
    seed: record.seed,
    startedAtMs: record.startedAtMs ?? null,
    simTimeMs: record.simTimeMs,
    tickIndex: record.tickIndex,
    scenarioTick: record.scenarioTick,
    sequences: parseJson<Record<string, number>>(record.sequences, {}),
    crew: parseJson<Record<string, SimEngineState["crew"][string]>>(record.crewState, {}),
    mission: bundle.mission ?? {
      o2: 20.9,
      co2: 850,
      pressure: 101.3,
      cabinTemp: 23.5,
      humidity: 40,
      cadCumulative: 0,
    },
    rng: { a: rng.a ?? 0, spare: rng.spare ?? null },
    fault: bundle.fault ?? null,
    crewIds: bundle.crewIds ?? [],
    exerciseCrewId: bundle.exerciseCrewId ?? "ayla-reyes",
    anomalyCrewId: bundle.anomalyCrewId ?? "ayla-reyes",
    radiationPeakUSvH: bundle.radiationPeakUSvH ?? 40,
    cansMultiplier: bundle.cansMultiplier ?? 8,
    stuckPayloads: bundle.stuckPayloads ?? {},
  };
}

export interface SimulationRuntimeOptions {
  engine?: SimulationEngine;
  sessions?: SimSessionStore;
  missionId?: string;
  /** Default: `process.env.SKY_SIM_AUTOSTART === "1"`. */
  autostart?: () => boolean;
  /** Boot retention (prune ngay + timer mỗi giờ). Default true. */
  retention?: boolean;
  /** Cài SIGINT/SIGTERM handler. Default true (tests tắt để không giết process). */
  signals?: boolean;
  /** Chỉ dùng trong test: engine không tự setInterval, test tự drive tick(). */
  manual?: boolean;
  log?: (line: string) => void;
  newRunId?: () => string;
}

/** Runtime testable: engine + session store injectable, không chạm singleton ở unit test. */
export class SimulationRuntime {
  private readonly engine: SimulationEngine;
  private readonly sessions: SimSessionStore;
  private readonly missionId: string;
  private readonly log: (line: string) => void;
  private readonly newRunId: () => string;
  private retention: { stop: () => void } | null = null;
  private runId: string;
  private booted = false;
  private shuttingDown = false;

  constructor(private readonly options: SimulationRuntimeOptions = {}) {
    this.engine = options.engine ?? simulationEngine;
    this.sessions = options.sessions ?? simSessionsRepo;
    this.missionId = options.missionId ?? SIM_MISSION_ID;
    this.log = options.log ?? ((line: string) => console.log(line));
    this.newRunId = options.newRunId ?? (() => crypto.randomUUID());
    this.runId = this.newRunId();
  }

  boot(): void {
    if (this.booted) return;
    this.booted = true;

    if (this.options.retention !== false) {
      try {
        this.retention = startTelemetryRetention();
      } catch (e) {
        console.error("[telemetry] retention start failed", e);
      }
    }

    const autostart = this.options.autostart ? this.options.autostart() : process.env.SKY_SIM_AUTOSTART === "1";
    if (!autostart) {
      this.log("[sim] autostart disabled");
      return;
    }

    this.installHooks();

    if (this.engine.isRunning()) {
      // Exactly one producer: engine đã chạy (vd. một runtime khác trong process) → không start lần hai.
      this.log("[sim] engine already running — no second producer");
      return;
    }

    const saved = this.sessions.get(this.missionId);
    if (saved && (saved.status === "running" || saved.status === "paused")) {
      try {
        this.runId = saved.runId || this.runId;
        this.engine.restoreState(stateFromSessionRecord(saved), { manual: this.options.manual === true });
        this.log(
          `[sim] restored ${saved.missionId} tick=${saved.tickIndex} scenario=${saved.scenario} speed=${saved.speed}x`,
        );
      } catch (e) {
        console.error("[sim] restore failed — starting fresh", e);
        this.startFresh();
      }
    } else {
      this.startFresh();
    }

    this.checkpoint("running");
    if (this.options.signals !== false) this.installSignals();
  }

  /** Checkpoint ngay (60 tick / stop / scenario change gọi hàm này). Best-effort. */
  checkpoint(status: SimSessionStatus): void {
    try {
      const state = this.engine.exportState();
      this.sessions.upsert(sessionRecordFromState(state, { runId: this.runId, status, updatedAt: Date.now() }));
    } catch (e) {
      console.error("[sim] checkpoint failed", e);
    }
  }

  /** Shutdown đường sạch: checkpoint "paused" (để boot sau restore) rồi mới stop engine. */
  shutdown(): void {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.checkpoint("paused");
    this.retention?.stop();
    this.retention = null;
    try {
      this.engine.stop();
    } catch (e) {
      console.error("[sim] stop failed", e);
    }
  }

  session(): SimSessionRecord | null {
    try {
      return this.sessions.get(this.missionId);
    } catch {
      return null;
    }
  }

  status(): SimStatus {
    return this.engine.status();
  }

  private startFresh(): void {
    this.runId = this.newRunId();
    this.engine.start({
      scenario: "normal",
      speed: 1,
      missionId: this.missionId,
      seed: SIM_DEFAULT_SEED,
      ...(this.options.manual === true ? { manual: true } : {}),
    });
    this.log(`[sim] autostarted ${this.missionId} run=${this.runId}`);
  }

  private installHooks(): void {
    this.engine.setHooks({
      onTick: ({ tickIndex }) => {
        if (tickIndex % CHECKPOINT_EVERY_TICKS === 0) this.checkpoint("running");
      },
      onStop: () => {
        if (!this.shuttingDown) this.checkpoint("stopped");
      },
      onScenarioChange: () => this.checkpoint("running"),
    });
  }

  private installSignals(): void {
    const handler = () => {
      this.shutdown();
      process.exit(0);
    };
    process.once("SIGINT", handler);
    process.once("SIGTERM", handler);
  }
}

let runtime: SimulationRuntime | null = null;

/** Gọi từ server.ts sau seed, trước listen. Idempotent trong một process. */
export function bootSimulation(): void {
  if (runtime) return;
  runtime = new SimulationRuntime();
  try {
    runtime.boot();
  } catch (e) {
    console.error("[sim] boot failed", e);
  }
}

/** Shutdown runtime singleton (signal handler / test). */
export function shutdownSimulation(): void {
  runtime?.shutdown();
}

export function simulationRuntime(): SimulationRuntime | null {
  return runtime;
}
