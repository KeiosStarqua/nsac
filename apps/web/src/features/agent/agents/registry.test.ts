import { describe, it, expect } from "vitest";
import { AGENT_REGISTRY, getAgent, listAgents, specialists } from "./registry";

describe("registry", () => {
  it("ids unique", () => {
    const ids = Object.keys(AGENT_REGISTRY);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every profile valid", () => {
    for (const p of listAgents()) {
      expect(p.soul.length).toBeGreaterThan(0);
      expect(p.output).toBeTruthy();
      expect(p.defaultModel).toBeTruthy();
      expect(p.timeoutMs).toBeGreaterThan(0);
    }
  });
  it("specialists excludes orchestrator", () => {
    expect(specialists().every((a) => a.id !== "sky-orchestrator")).toBe(true);
  });
  it("routing table", async () => {
    const { routeRequest } = await import("./orchestrator");
    expect(routeRequest("compose a panel")).toBe("sky-generative-ui");
    expect(routeRequest("hello")).toBeNull();
  });
  it("hud composer registered", () => {
    const profile = getAgent("sky-hud-composer");
    expect(profile.role).toBe("hud composer");
    const output = profile.output;
    if (output.kind !== "openui-program") throw new Error("expected an openui-program output contract");
    expect(output.maxChars).toBe(4000);
    expect(output.allowList).toContain("Surface");
    expect(profile.timeoutMs).toBe(30000);
  });
  it("medical officer registered", () => {
    const profile = getAgent("sky-medical-officer");
    expect(profile.role).toBe("clinical-synthesis");
    expect(profile.id).toBe("sky-medical-officer");
    expect(profile.soul.length).toBeGreaterThan(0);
    expect(profile.defaultModel).toBeTruthy();
    expect(profile.tools).toEqual([]);
    expect(profile.handoff).toEqual([]);
    const output = profile.output;
    if (output.kind !== "clinical-case-summary") throw new Error("expected a clinical-case-summary output contract");
    expect(output.maxChars).toBe(2000);
    expect(profile.timeoutMs).toBe(45000);
  });
});