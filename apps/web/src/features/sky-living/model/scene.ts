// Scene IR — the declarative vocabulary the scene planner emits and the renderer walks.
// AI output is a Scene, never executable code. Everything the renderer shows is referenced or
// declared here; validated by validateScene(). Simulated mission data only.

/** The interface-configuration state machine states (UX.md §4). */
export type UxState =
  | "presence"
  | "listening"
  | "processing"
  | "attention"
  | "understanding"
  | "decision"
  | "continuity"
  | "connection"
  | "emergency";

/** Deterministic interruption policy (UX.md §6). Only validated rules escalate P0/P1; an LLM may never downgrade. */
export type Priority = "P0" | "P1" | "P2" | "P3" | "P4" | "P5";

export type DeviceClass =
  | "command-display"
  | "tablet"
  | "workstation"
  | "watch"
  | "ar-headset"
  | "eva-hud"
  | "medical-bay"
  | "sleep-pod"
  | "exercise"
  | "rover"
  | "earth"
  | "audio";

/** Six visual primitives from UX.md §2. */
export type PrimitiveKind = "core" | "orbit" | "membrane" | "filament" | "pulse" | "field";

export type Intent =
  | "daily-wellness"
  | "why-tired"
  | "recovery-deviation"
  | "evidence"
  | "exercise-guidance"
  | "medical-decision"
  | "emergency"
  | "eva-monitoring"
  | "earth-consult"
  | "sleep-report"
  | "radi-exposure"
  | "unknown";

export interface SceneEntity {
  /** Which primitive this entity is. */
  readonly kind: PrimitiveKind;
  /** Stable id referenced by filaments. */
  readonly id: string;
  readonly label?: string;
  /** Free text, never digits: numbers flow through `measurementRef` or `Fact`-style refs. */
  readonly detail?: string;
  /** Reference into the simulated measurement set (metric id in DATA). */
  readonly measurementRef?: string;
  /** Optional polar placement for the field (0..1 around the core). */
  readonly angle?: number;
}

export interface SceneInteraction {
  readonly voice: boolean;
  readonly touch: boolean;
  /** No approval, "review" (astronaut looks, then may approve), or "required" (blocks on explicit approval). */
  readonly approval: "none" | "review" | "required";
}

export interface Scene {
  readonly schemaVersion: "1.0";
  readonly id: string;
  readonly state: UxState;
  readonly priority: Priority;
  readonly intent: Intent;
  readonly title: string;
  readonly summary: string;
  readonly entities: readonly SceneEntity[];
  readonly interaction: SceneInteraction;
  /** Deterministic fallback rendered if the scene is rejected or capabilities cannot map it. */
  readonly fallback: string;
  /** Explicit uncertainty / provenance note (UX.md: distinguish observations from estimates). */
  readonly caveat?: string;
  /** Everything here is simulated mission data; never represent it as a real patient. */
  readonly simulated: true;
}

/** Validates a scene produced by the planner (deterministic today; LLM-backed scenes pass the same gate). */
export function validateScene(scene: unknown): { ok: true; scene: Scene } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  if (typeof scene !== "object" || scene === null) return { ok: false, reasons: ["scene is not an object"] };
  const s = scene as Record<string, unknown>;
  if (s.schemaVersion !== "1.0") reasons.push("schemaVersion mismatch");
  for (const key of ["id", "state", "priority", "intent", "title", "summary", "fallback"] as const) {
    if (typeof s[key] !== "string" || !s[key]) reasons.push(`${key} missing`);
  }
  if (!Array.isArray(s.entities)) reasons.push("entities not an array");
  else {
    for (const e of s.entities) {
      if (typeof e !== "object" || e === null) { reasons.push("entity not an object"); continue; }
      const ent = e as Record<string, unknown>;
      if (!["core", "orbit", "membrane", "filament", "pulse", "field"].includes(ent.kind as string)) reasons.push(`bad primitive ${ent.kind}`);
      if (typeof ent.id !== "string" || !ent.id) reasons.push("entity id missing");
    }
  }
  if (typeof s.interaction !== "object" || s.interaction === null) reasons.push("interaction missing");
  else {
    const i = s.interaction as Record<string, unknown>;
    if (typeof i.voice !== "boolean" || typeof i.touch !== "boolean") reasons.push("interaction flags invalid");
    if (!["none", "review", "required"].includes(i.approval as string)) reasons.push("approval invalid");
  }
  if (s.simulated !== true) reasons.push("simulated flag required");
  // Free text must not carry digits — numbers ride through measurementRef.
  const texts = [s.title, s.summary, s.caveat, ...(Array.isArray(s.entities) ? s.entities.map((e) => (e as { detail?: string }).detail ?? "") : [])];
  for (const t of texts) if (typeof t === "string" && /[0-9]/.test(t)) reasons.push("digit leaked into free text");
  return reasons.length ? { ok: false, reasons } : { ok: true, scene: scene as Scene };
}
