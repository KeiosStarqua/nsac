import { describe, it, expect } from "vitest";
import { hudLibrary, parseHudProgram } from "./catalog";
import { HUD_PRESET_EN, HUD_PRESET_VI, hudPreset } from "./presets";
import { HUD_COMPONENT_NAMES, HUD_FACT_IDS } from "./model/names";
import { collectFacts } from "./model/review";
import { buildHudFacts } from "./model/facts";

describe("hud catalog", () => {
  it("registers exactly the HUD component names, no more, no less", () => {
    const registered = Object.keys(hudLibrary.components).sort();
    expect(registered).toEqual([...HUD_COMPONENT_NAMES].sort());
    expect(new Set(registered).size).toBe(registered.length);
  });
  it("registers the eight HUD actions", () => {
    expect(Object.keys(hudLibrary.actions).sort()).toEqual([
      "ChangeAstronaut",
      "DismissComposeHint",
      "OpenHologram",
      "OpenMission",
      "OpenVital",
      "OpenWellness",
      "ToggleChat",
      "ToggleMic",
    ]);
  });
});

describe("hud presets", () => {
  for (const [name, preset] of [["en", HUD_PRESET_EN], ["vi", HUD_PRESET_VI]] as const) {
    it(`parses cleanly against the catalog (${name})`, () => {
      const parsed = parseHudProgram(preset);
      expect(parsed.meta.errors).toEqual([]);
      expect(parsed.meta.incomplete).toBe(false);
      expect(parsed.meta.unresolved).toEqual([]);
      expect(parsed.root).toBeTruthy();
    });
  }
  it("hudPreset picks by locale", () => {
    expect(hudPreset("en")).toBe(HUD_PRESET_EN);
    expect(hudPreset("vi")).toBe(HUD_PRESET_VI);
  });
  it("every Fact id a preset-style program could use resolves in the facts builder", () => {
    for (const id of HUD_FACT_IDS) {
      const program = `root = Surface([footer, fact])\nfooter = FooterNote()\nfact = Fact("${id}")`;
      const parsed = parseHudProgram(program);
      expect(parsed.meta.errors, `Fact(${id}) must parse`).toEqual([]);
      const used = collectFacts(parsed.root);
      expect(used).toContain(id);
      expect(buildHudFacts()[id]).toBeTruthy();
    }
  });
});
