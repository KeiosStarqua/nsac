import { describe, it, expect } from "vitest";
import {
  extractProgram,
  reviewProgram,
  hasDigit,
  isMachineLiteral,
  collectFacts,
  collectComponents,
  MAX_PROGRAM_CHARS,
} from "./review";
import { HUD_PRESET_EN, HUD_PRESET_VI } from "../presets";
import { parseHudProgram } from "../catalog";
import { HUD_COMPONENT_NAMES } from "./names";

const review = (source: string) => reviewProgram(source, { allowList: HUD_COMPONENT_NAMES }, parseHudProgram);

describe("extractProgram", () => {
  it("strips think blocks and fences", () => {
    const raw = "<think>hmm</think>```openui\nroot = Surface([])```";
    expect(extractProgram(raw)).toBe("root = Surface([])");
  });
  it("trims plain text when unfenced", () => {
    expect(extractProgram("  root = Surface([])\n")).toBe("root = Surface([])");
  });
});

describe("digit guards", () => {
  it("flags digits in text", () => {
    expect(hasDigit("HR 62 bpm")).toBe(true);
    expect(hasDigit("spo2")).toBe(true); // the vital id carries one…
  });
  it("allows exact machine tokens", () => {
    expect(isMachineLiteral("spo2")).toBe(true);
    expect(isMachineLiteral("HR 62 bpm")).toBe(false);
    expect(isMachineLiteral("spo2 ")).toBe(false);
  });
});

describe("collectFacts / collectComponents", () => {
  it("walks the parsed preset tree", () => {
    const parsed = parseHudProgram(HUD_PRESET_EN);
    expect(collectComponents(parsed.root)).toContain("Surface");
    expect(collectComponents(parsed.root)).toContain("MetricTile");
  });
});

describe("reviewProgram", () => {
  it("accepts the EN preset", () => {
    const result = review(HUD_PRESET_EN);
    expect(result.ok, result.ok ? "" : result.reasons.join(", ")).toBe(true);
  });
  it("accepts the VI preset", () => {
    const result = review(HUD_PRESET_VI);
    expect(result.ok, result.ok ? "" : result.reasons.join(", ")).toBe(true);
  });
  it("rejects a digit in free text", () => {
    const result = review(`root = Surface([header])
header = Section("header", [alert])
alert = Alert("info", "Heart rate is 62 bpm")`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("digit in free text");
  });
  it("accepts a digit only inside the spo2 machine token", () => {
    const result = review(`root = Surface([header])
header = Section("vitals", [tile])
tile = MetricTile("spo2")`);
    expect(result.ok).toBe(true);
  });
  it("rejects an unknown component", () => {
    const result = review(`root = Surface([bogus])
bogus = Frobnicate()`);
    expect(result.ok).toBe(false);
  });
  it("rejects an overlong program", () => {
    const result = review("x".repeat(MAX_PROGRAM_CHARS + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("too long");
  });
  it("rejects an empty program", () => {
    expect(review("")).toEqual({ ok: false, reasons: ["empty"] });
  });
});
