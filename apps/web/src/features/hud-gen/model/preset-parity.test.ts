import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseHudProgram } from "../catalog";
import { HUD_PRESET_EN, HUD_PRESET_VI, hudPreset } from "../presets";
import { collectComponents } from "./review";

// The parity guard. `/` (`features/hud-mock/SkyHudMock.tsx`) and `/?arch=openui`
// (`features/hud-gen/SkyScreenGen.tsx` + the preset) must present the same layout: same regions, in
// the same order. The catalog deliberately renders the mock's own modules, so this test checks both
// halves of the contract:
//   1. the mock really renders these regions in this order;
//   2. the preset declares the identical sequence (and parses cleanly);
//   3. the catalog imports the mock modules instead of re-implementing the layout.
// No browser, no React render: deterministic and cheap.

/** Region order as the mock renders it (see `SkyHudMock.tsx`). `ReadinessDetail` = catalog `ReadinessTabs`. */
const MOCK_ORDER = [
  "MockHeader",
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
  "ReadinessDetail",
  "MiniCards",
] as const;

/** The preset's component names for the same regions. */
const PRESET_ORDER = [
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
] as const;

const mockSource = readFileSync(new URL("../../hud-mock/SkyHudMock.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../catalog.tsx", import.meta.url), "utf8");

describe("mock ↔ gen parity", () => {
  it("the mock renders the shared regions in the declared order", () => {
    const offsets = MOCK_ORDER.map((name) => mockSource.indexOf(`<${name}`));
    expect(offsets.filter((offset) => offset < 0)).toEqual([]);
    const sorted = [...offsets].sort((a, b) => a - b);
    expect(offsets).toEqual(sorted);
  });

  it("both presets declare the mock's regions in the same order", () => {
    for (const [name, preset] of [["en", HUD_PRESET_EN], ["vi", HUD_PRESET_VI]] as const) {
      const parsed = parseHudProgram(preset);
      expect(parsed.meta.errors, `${name} must parse`).toEqual([]);
      const declared = collectComponents(parsed.root).filter((component) => component !== "Surface");
      expect(declared, `${name} region order`).toEqual([...PRESET_ORDER]);
    }
    expect(hudPreset("en")).toBe(HUD_PRESET_EN);
    expect(hudPreset("vi")).toBe(HUD_PRESET_VI);
  });

  it("the catalog wraps the mock modules instead of duplicating the layout", () => {
    // The wrappers are the mock's own components...
    for (const name of [
      "MockHeader",
      "MockProfileCard",
      "MockVitalsCard",
      "MockTrendsCard",
      "MockOrbStage",
      "MockGreetingStack",
      "MockVoiceWave",
      "MockVoiceCluster",
      "MockInsightBand",
      "MockReadinessCard",
      "MockReadinessDetail",
      "MockMiniCards",
    ]) {
      expect(catalogSource, `catalog must render ${name}`).toContain(name);
    }
    // ...and the layout/class strings come from the mock's module, not the deleted staged screen.
    expect(catalogSource).toContain('from "~/features/hud-mock"');
    expect(catalogSource).toContain('from "~/features/hud-mock/mock-classes"');
    expect(catalogSource).not.toContain("sky-hud/hud-classes");
    expect(catalogSource).not.toContain("VITALS_PROJECTION");
    expect(catalogSource).not.toContain("HEALTH_PROJECTION");
    expect(catalogSource).not.toContain("CONVERSATION");
  });
});
