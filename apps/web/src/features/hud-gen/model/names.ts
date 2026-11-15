// The component names the HUD catalog registers, in one place so the agent registry, the composer
// profile, `model/review.ts` and the catalog tests all read the same list. No React in here.

/**
 * Every component the `features/hud-gen` catalog registers. Regions mirror the mock console
 * (`features/hud-mock/SkyHudMock.tsx`), and the region order below is the order the mock renders:
 * Header → left column (profile, vitals, trends) → centre column (orb, greeting, wave, voice,
 * insight) → right column (readiness, tabs, mini cards) → Footer. `Surface` is the root.
 */
export const HUD_COMPONENT_NAMES = [
  "Surface",
  "Header",
  "LeftColumn",
  "ProfileCard",
  "VitalsCard",
  "TrendsCard",
  "CenterColumn",
  "OrbStage",
  "GreetingStack",
  "VoiceWave",
  "VoiceCluster",
  "InsightBand",
  "RightColumn",
  "ReadinessCard",
  "ReadinessTabs",
  "MiniCards",
  "Footer",
  "Fact",
  "Alert",
] as const;

export type HudComponentName = (typeof HUD_COMPONENT_NAMES)[number];

/** Fact ids the HUD facts builder produces. Programs may reference these and nothing else. */
export const HUD_FACT_IDS = ["heartRate", "respiration", "spo2", "sleep", "missionDay"] as const;

export type HudFactId = (typeof HUD_FACT_IDS)[number];

/** The action names the catalog registers. The host maps each to its own behavior by type. */
export const HUD_ACTION_NAMES = [
  "OpenMission",
  "ChangeAstronaut",
  "ToggleChat",
  "ToggleMic",
  "DismissComposeHint",
] as const;

export type HudActionName = (typeof HUD_ACTION_NAMES)[number];
