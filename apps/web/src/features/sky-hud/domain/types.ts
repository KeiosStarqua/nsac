// SKY HUD — shared contracts (spec §4). Everything the screen renders derives from SkySceneModel.
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
export type VitalVisualState = "normal" | "advisory" | "warning" | "critical" | "unknown";
export type HealthState = "stable" | "attention" | "critical" | "unknown";
export type PerformanceTier = "high" | "balanced" | "low";

export interface VitalReading {
  kind: VitalKind;
  value: number | null; // sleep: total minutes
  unit: "bpm" | "br/min" | "%" | "min";
  timestamp: string | null; // ISO 8601
  source: string;
  quality: "good" | "poor" | "unknown";
  visualState: VitalVisualState;
  /** baseline + MAD for the detail projections (never rendered as digits in free text). */
  baseline?: number;
  mad?: number;
  trend?: "stable" | "falling" | "rising";
}

export interface MissionContextData {
  stationLabel: string;
  missionDay: number;
  spacecraftTimeIso?: string;
  online: boolean;
}

export interface HealthAssessment {
  state: HealthState;
  summary: string;
  assessedAt: string | null;
  provenance: string | null;
  bodyRegions?: Array<{ id: string; state: VitalVisualState }>;
}

export interface SkySceneModel {
  astronautDisplayName: string;
  mission: MissionContextData;
  vitals: Record<VitalKind, VitalReading>;
  health: HealthAssessment;
  voicePhase: VoicePhase;
  currentTranscript?: string;
  responseText?: string;
  voiceEnergy: number; // normalized 0..1
  performanceTier: PerformanceTier;
  reducedMotion: boolean;
}
