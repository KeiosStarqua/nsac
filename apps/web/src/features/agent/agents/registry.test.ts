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
});