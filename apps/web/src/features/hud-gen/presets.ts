// The built-in layouts. Both presets are locale-agnostic BY CONSTRUCTION: every string, value and
// node resolves through HudScopeContext (copy, fixture, phase) at render time, so the programs carry
// no text at all — and therefore no digits either. They exist as two entry points so a locale can
// diverge later (layout tweaks, extra regions) without touching the renderer or the host.
//
// The layout is the mock console's, region for region and in the same order:
//   Header → LeftColumn (ProfileCard, VitalsCard, TrendsCard)
//          → CenterColumn (OrbStage, GreetingStack, VoiceWave, VoiceCluster, InsightBand)
//          → RightColumn (ReadinessCard, ReadinessTabs, MiniCards) → Footer
// Every region component renders a `features/hud-mock` module, so the tree and `/` cannot drift.
//
// Both presets must parse cleanly against the HUD catalog — `catalog.test.ts` checks that, and
// `model/preset-parity.test.ts` checks this order against the mock.
// Syntax: OpenUI Lang, positional props matching the zod key order in `catalog.tsx`.
const PRESET_BODY = `root = Surface([header, left, center, right, footer])
header = Header()
left = LeftColumn([profile, vitals, trends])
profile = ProfileCard()
vitals = VitalsCard()
trends = TrendsCard()
center = CenterColumn([orb, greeting, wave, voice, insight])
orb = OrbStage()
greeting = GreetingStack()
wave = VoiceWave()
voice = VoiceCluster()
insight = InsightBand()
right = RightColumn([readiness, tabs, mini])
readiness = ReadinessCard()
tabs = ReadinessTabs()
mini = MiniCards()
footer = Footer()`;

export const HUD_PRESET_EN = PRESET_BODY;

export const HUD_PRESET_VI = PRESET_BODY;

export type HudPresetLocale = "en" | "vi";

export function hudPreset(locale: HudPresetLocale): string {
  return locale === "vi" ? HUD_PRESET_VI : HUD_PRESET_EN;
}
