import { describe, it, expect } from "vitest";
import { validateProgram, stripFences } from "./openui.server";

describe("openui", () => {
  it("cleans fenced", () => {
    const r = validateProgram("```\nConsole\n```", 100, ["Console"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.program).toBe("Console");
  });
  it("rejects over length", () => {
    const r = validateProgram("Console".repeat(100), 10, ["Console"]);
    expect(r.ok).toBe(false);
  });
  it("rejects digit", () => {
    const r = validateProgram("Say hello 5", 100, ["Say"]);
    expect(r.ok).toBe(false);
  });
  it("rejects unknown component", () => {
    const r = validateProgram("Foo", 100, ["Console"]);
    expect(r.ok).toBe(false);
  });
  it("valid passes", () => {
    const r = validateProgram("Console", 100, ["Console"]);
    expect(r.ok).toBe(true);
  });
});