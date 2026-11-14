// The component names the HUD catalog registers, in one place so the agent registry, the composer
// profile, `model/review.ts` and the catalog tests all read the same list. No React in here.

/** Every component the `features/hud-gen` catalog registers. `Section` is layout chrome; the rest are the HUD parts. */
export const HUD_COMPONENT_NAMES = [
  "Surface",
  "Section",
  "BrandBlock",
  "MissionButton",
  "HologramButton",
  "Greeting",
  "AskPrompt",
  "MetricRow",
  "MetricTile",
  "Fact",
  "WellnessCard",
  "Alert",
  "FixtureBadge",
  "OrbCanvas",
  "WaveCanvas",
  "MicButton",
  "ChatButton",
  "ChangeAstronautButton",
  "FooterNote",
] as const;

export type HudComponentName = (typeof HUD_COMPONENT_NAMES)[number];

/** Fact ids the HUD facts builder produces. Programs may reference these and nothing else. */
export const HUD_FACT_IDS = ["heartRate", "respiration", "spo2", "sleep", "missionDay"] as const;

export type HudFactId = (typeof HUD_FACT_IDS)[number];

/** The action names the catalog registers. The host maps each to its own behavior by type. */
export const HUD_ACTION_NAMES = [
  "OpenVital",
  "OpenWellness",
  "OpenMission",
  "OpenHologram",
  "ChangeAstronaut",
  "ToggleChat",
  "ToggleMic",
  "DismissComposeHint",
] as const;

export type HudActionName = (typeof HUD_ACTION_NAMES)[number];

/** Vital kinds that may ride the `OpenVital` action payload. */
export const HUD_VITAL_KINDS = ["heartRate", "respiration", "spo2", "sleep"] as const;

export type HudVitalKind = (typeof HUD_VITAL_KINDS)[number];
