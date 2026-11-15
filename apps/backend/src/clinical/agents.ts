import type { MedicalAgentDefinition } from "./types";

// sky-cardio — deterministic cardiovascular specialist (P0). Generic engine: specialists are
// config; OTHER specialists (sleep/musculoskeletal/environment) are P1 and NOT built here.
//
// Routine semantics (V1):
// - { kind: "interval", everyMinutes: 5 } — runs on the scheduler tick when the most recent
//   completed 5-minute UTC bucket has no routine_runs row yet (see scheduler.ts).
// - { kind: "daily", at: "07:00" } — once per server-local day at/after 07:00.
// - { kind: "manual" } — chỉ qua POST /api/clinical/routines/sky-cardio:manual/run.
// - { kind: "event", topic } — RESERVED, không implement ở V1 (types.ts).
export const cardioAgent: MedicalAgentDefinition = {
  id: "sky-cardio",
  specialty: "cardiovascular",
  metrics: ["heart_rate_bpm"],
  modelTask: "hr",
  policyId: "cardio-v1",
  routines: [
    { kind: "interval", everyMinutes: 5 },
    { kind: "daily", at: "07:00" },
    { kind: "manual" },
  ],
  output: "clinical-finding",
};

export const MEDICAL_AGENTS: MedicalAgentDefinition[] = [cardioAgent];

export const medicalAgentById = new Map(MEDICAL_AGENTS.map((a) => [a.id, a]));

/** routine_id dùng trong routine_runs + routes: `<agentId>:<kind>`. */
export function routineIdOf(agentId: string, kind: string): string {
  return `${agentId}:${kind}`;
}
