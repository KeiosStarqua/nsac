// Agent states for the Sky orb — the single source of truth every screen maps its
// voice/agent signals onto before the Crystalized Ball renders. The ball knows nothing
// about voice mechanics: `AGENT_STATE_BALL` is the only coupling, one row per state,
// and every row pins `particleCount` so a state change never rebuilds the dust buffer.
//
// States (many, deliberately — the mic flow exposes all of them in order):
//   idle       ambient; nothing running (default look).
//   connecting mic tapped; permission / engine registration / session is starting.
//   listening  session live; Sky is awaiting the astronaut's voice.
//   thinking   Sky is working (transcribing / composing) — no audio, visible effort.
//   speaking   Sky is answering out loud.
//   error      mic or engine failure; the hint offers typed input instead.
import type { VoicePhase } from "./types";

export type AgentState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export const AGENT_STATES: readonly AgentState[] = ["idle", "connecting", "listening", "thinking", "speaking", "error"];

/** Crystalized Ball recipe per agent state (`preset` + uniforms that read per frame — all live-swappable). */
export interface AgentBallTuning {
  preset: "aurora" | "frost" | "nebula" | "solar" | "ember";
  speed: number;
  glow: number;
  crackle: number;
  sparks: number;
  twinkle: number;
  haze: number;
  /** Pinned identical across states; a differing `preset` default would trigger a one-time dust rebuild. */
  particleCount: number;
}

export const AGENT_STATE_BALL: Record<AgentState, AgentBallTuning> = {
  // Ambient mint — calm, slow, fully reversible identity of the console.
  idle: { preset: "aurora", speed: 0.9, glow: 0.8, crackle: 0.6, sparks: 0.45, twinkle: 0.5, haze: 0.7, particleCount: 15000 },
  // Aurora charges up: brighter, quicker crackle, more sparks — Sky is waking.
  connecting: { preset: "aurora", speed: 1.9, glow: 1.1, crackle: 0.8, sparks: 0.75, twinkle: 0.7, haze: 0.8, particleCount: 15000 },
  // Pale frost — open and attentive; the quietest of the live states.
  listening: { preset: "frost", speed: 1.15, glow: 0.7, crackle: 0.35, sparks: 0.25, twinkle: 0.45, haze: 0.55, particleCount: 15000 },
  // Violet nebula, rising and swaying — Sky is working, processing heard speech.
  thinking: { preset: "nebula", speed: 2.3, glow: 1.0, crackle: 0.85, sparks: 0.65, twinkle: 0.6, haze: 0.8, particleCount: 15000 },
  // Solar gold, flares — Sky is radiating an answer out loud.
  speaking: { preset: "solar", speed: 1.5, glow: 1.15, crackle: 0.7, sparks: 0.55, twinkle: 0.55, haze: 0.8, particleCount: 15000 },
  // Ember orange, low motion — warning that carried a human action next (type instead).
  error: { preset: "ember", speed: 0.8, glow: 0.75, crackle: 0.9, sparks: 0.3, twinkle: 0.5, haze: 0.6, particleCount: 15000 },
};

/** Staged/gen console path (`useSkyVoice`): one VoicePhase → one agent state. */
export function agentStateForVoicePhase(phase: VoicePhase): AgentState {
  switch (phase) {
    case "requesting_permission":
      return "connecting";
    case "listening":
      return "listening";
    case "transcribing":
    case "thinking":
      return "thinking";
    case "speaking":
      return "speaking";
    case "offline":
    case "error":
      return "error";
    case "idle":
      return "idle";
  }
}

/**
 * Speech Engine voice-chat path (`useVoiceChat` on `/`): the notice types are structurally
 * matched so this module never imports the hook (sky-hud stays dependency-free). A quiet notice
 * (mic denied, engine missing) outranks everything — the ball must warn, not hum on.
 */
export function agentStateForVoiceChat(
  status: "idle" | "connecting" | "live",
  mode: "listening" | "speaking",
  notice: "notConfigured" | "failed" | null,
): AgentState {
  if (notice) return "error";
  if (status === "connecting") return "connecting";
  if (status === "live") return mode === "speaking" ? "speaking" : "listening";
  return "idle";
}
