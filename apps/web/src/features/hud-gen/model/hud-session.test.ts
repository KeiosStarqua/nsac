import { describe, it, expect } from "vitest";
import { hudSessionFileName, hudSessionId } from "./hud-session";

describe("hud session file helpers", () => {
  it("builds the per-astronaut composer transcript name", () => {
    expect(hudSessionId("nova")).toBe("nova.hud");
    expect(hudSessionFileName("nova")).toBe("nova.hud.jsonl");
  });
  it("normalises case and whitespace like the chat sanitizer", () => {
    expect(hudSessionFileName("  NOVA-2 ")).toBe("nova-2.hud.jsonl");
  });
  it("refuses path traversal, spaces, slashes and overlong ids", () => {
    expect(hudSessionFileName("../escape")).toBeNull();
    expect(hudSessionFileName("a/b")).toBeNull();
    expect(hudSessionFileName("a b")).toBeNull();
    expect(hudSessionFileName("a".repeat(65))).toBeNull();
    expect(hudSessionFileName("")).toBeNull();
  });
  it("caps the base id at 64 chars before appending the suffix", () => {
    const name = hudSessionFileName("a".repeat(64));
    expect(name).toBe(`${"a".repeat(64)}.hud.jsonl`);
    expect(name).not.toContain("/");
  });
});
