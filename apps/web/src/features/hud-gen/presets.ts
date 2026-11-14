// The built-in layouts. Both presets are locale-agnostic BY CONSTRUCTION: every string, value and
// node resolves through HudScopeContext (copy, facts, phase) at render time, so the programs carry
// no text at all — and therefore no digits either. They exist as two entry points so a locale can
// diverge later (layout tweaks, extra regions) without touching the renderer or the host.
//
// Both presets must parse cleanly against the HUD catalog — `catalog/catalog.test.ts` checks that.
// Syntax: OpenUI Lang, positional props matching the zod key order in `catalog.tsx`.
export const HUD_PRESET_EN = `root = Surface([header, vitals, conversation, health, voice, input, footer])
header = Section("header", [brand, mission])
brand = BrandBlock()
mission = MissionButton()
vitals = Section("vitals", [row, flag])
row = MetricRow([hr, resp, spo2, sleep])
hr = MetricTile("heartRate")
resp = MetricTile("respiration")
spo2 = MetricTile("spo2")
sleep = MetricTile("sleep", "violet")
flag = FixtureBadge()
conversation = Section("conversation", [greeting, prompt, orb, wave])
greeting = Greeting()
prompt = AskPrompt()
orb = OrbCanvas()
wave = WaveCanvas()
health = Section("health", [holo, wellness])
holo = HologramButton()
wellness = WellnessCard()
voice = Section("voice", [mic, typer])
mic = MicButton()
typer = ChatButton()
input = Section("input", [])
footer = FooterNote()`;

export const HUD_PRESET_VI = `root = Surface([header, vitals, conversation, health, voice, input, footer])
header = Section("header", [brand, mission])
brand = BrandBlock()
mission = MissionButton()
vitals = Section("vitals", [row, flag])
row = MetricRow([hr, resp, spo2, sleep])
hr = MetricTile("heartRate")
resp = MetricTile("respiration")
spo2 = MetricTile("spo2")
sleep = MetricTile("sleep", "violet")
flag = FixtureBadge()
conversation = Section("conversation", [greeting, prompt, orb, wave])
greeting = Greeting()
prompt = AskPrompt()
orb = OrbCanvas()
wave = WaveCanvas()
health = Section("health", [holo, wellness])
holo = HologramButton()
wellness = WellnessCard()
voice = Section("voice", [mic, typer])
mic = MicButton()
typer = ChatButton()
input = Section("input", [])
footer = FooterNote()`;

export type HudPresetLocale = "en" | "vi";

export function hudPreset(locale: HudPresetLocale): string {
  return locale === "vi" ? HUD_PRESET_VI : HUD_PRESET_EN;
}
