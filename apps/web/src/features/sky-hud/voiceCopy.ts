import type { VoicePhase } from "./types";

// Fixture-era English strings for the voice state machine, shared by the staged HUD and the watch layout.
export const PHASE_TEXT: Record<VoicePhase, string> = {
  idle: "Just talk to me...",
  requesting_permission: "Requesting microphone access…",
  listening: "Listening… Tap to stop",
  transcribing: "SKY is processing…",
  thinking: "SKY is processing…",
  speaking: "SKY is speaking…",
  offline: "SKY is offline — the UI keeps working",
  error: "Mic unavailable — type instead",
};

export const MIC_ARIA: Record<VoicePhase, string> = {
  idle: "Activate microphone",
  requesting_permission: "Requesting microphone permission",
  listening: "Stop microphone capture",
  transcribing: "SKY is processing",
  thinking: "SKY is thinking",
  speaking: "SKY is speaking",
  offline: "Microphone unavailable",
  error: "Microphone unavailable — type instead",
};
