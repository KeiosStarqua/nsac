import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Durable simulator session (SENSOR_SIMULATION_SPEC §14 "Continuous runtime (v2)").
// Một row / mission (PK mission_id) — checkpoint 60 tick, on stop, on scenario change.
// JSON columns là state engine đã export (`SimulationEngine.exportState()`); không query bên trong.
export const simSessions = sqliteTable("sim_sessions", {
  missionId: text("mission_id").primaryKey(),
  /** Id của run hiện tại (uuid mỗi lần boot/start) — chỉ để trace, không tham gia determinism. */
  runId: text("run_id").notNull(),
  scenario: text("scenario").notNull(),
  speed: integer("speed").notNull(),
  seed: text("seed").notNull(),
  /** running | paused (shutdown graceful, sẽ restore) | stopped (stop qua API, không restore). */
  status: text("status").notNull(),
  startedAtMs: integer("started_at_ms"),
  simTimeMs: integer("sim_time_ms").notNull(),
  tickIndex: integer("tick_index").notNull(),
  /** Tick bắt đầu scenario hiện tại — envelope scenario đếm từ đây (PR5 switch giữa phiên). */
  scenarioTick: integer("scenario_tick").notNull(),
  sequences: text("sequences").notNull(),
  crewState: text("crew_state").notNull(),
  missionState: text("mission_state").notNull(),
  rngState: text("rng_state").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
