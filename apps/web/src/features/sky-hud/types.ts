// Shared types for the HUD feature — no digits in free text; fixture data is labeled.
export type VoicePhase =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "offline"
  | "error";
export type VitalKind = "heartRate" | "respiration" | "spo2" | "sleep";
