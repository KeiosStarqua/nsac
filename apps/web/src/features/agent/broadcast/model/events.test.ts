import { describe, it, expect } from "vitest";
import {
  INJECTABLE_TOPICS,
  EVENT_TOPICS,
  buildFactsBlock,
  changeEventSchema,
  hazardDetectedPayloadSchema,
} from "./events";

const hazard = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  astronautId: "ayla-reyes",
  topic: "hazard.detected",
  source: "radiation-worker",
  summary: null,
  payload: { hazard: "radiation", severity: "yellow", summary: "Dose 1.4x baseline" },
  createdAt: 1_700_000_000_000 + id,
  ...overrides,
});

const healthFact = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  astronautId: null,
  topic: "health.fact.updated",
  source: "osdr-feed",
  summary: null,
  payload: { fact: "spo2", value: 97, unit: "%" },
  createdAt: 1_700_000_000_000 + id,
  ...overrides,
});

const claim = (id: number) => ({
  id,
  astronautId: "tomas-ortega",
  topic: "claims.changed",
  source: "web-claims",
  summary: null,
  payload: { astronautId: "tomas-ortega", action: "claimed" },
  createdAt: 1_700_000_000_000 + id,
});

describe("event schemas (wire-mirror)", () => {
  it("EVENT_TOPICS carries the four backend topics", () => {
    expect(EVENT_TOPICS).toEqual(["hazard.detected", "health.fact.updated", "claims.changed", "agent.turn.completed"]);
    expect(INJECTABLE_TOPICS).toEqual(["hazard.detected", "health.fact.updated", "claims.changed"]);
    expect(INJECTABLE_TOPICS).not.toContain("agent.turn.completed");
  });

  it("changeEventSchema parses a backend row", () => {
    expect(changeEventSchema.safeParse(hazard(1)).success).toBe(true);
    expect(changeEventSchema.safeParse({ ...hazard(1), id: -1 }).success).toBe(false);
  });

  it("hazardDetectedPayloadSchema enforces bounds", () => {
    expect(hazardDetectedPayloadSchema.safeParse({ hazard: "radiation", severity: "yellow" }).success).toBe(true);
    expect(hazardDetectedPayloadSchema.safeParse({ hazard: "radiation", severity: "purple" }).success).toBe(false);
    expect(hazardDetectedPayloadSchema.safeParse({ hazard: "x", severity: "yellow", evidenceIds: Array(9).fill("e") }).success).toBe(false);
  });
});

describe("buildFactsBlock", () => {
  it("returns null for no events / only non-injectable topics", () => {
    expect(buildFactsBlock([])).toBeNull();
    expect(
      buildFactsBlock([
        {
          id: 1,
          astronautId: "a",
          topic: "agent.turn.completed",
          source: "web-astro-chat",
          summary: null,
          payload: { astronautId: "a", agentId: "sky-chat", ok: true },
          createdAt: 1,
        },
      ]),
    ).toBeNull();
  });

  it("renders oldest first, one line each, with source", () => {
    const block = buildFactsBlock([hazard(3), healthFact(1), claim(2)])!;
    const lines = block.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("- [info|spo2] spo2: 97 % (source: osdr-feed)");
    expect(lines[1]).toBe("- [info|claims] tomas-ortega claimed (source: web-claims)");
    expect(lines[2]).toBe("- [yellow|radiation] Dose 1.4x baseline (source: radiation-worker)");
  });

  it("prefers the event-level summary over the payload summary", () => {
    const block = buildFactsBlock([hazard(1, { summary: "outer summary" })])!;
    expect(block).toBe("- [yellow|radiation] outer summary (source: radiation-worker)");
  });

  it("skips malformed rows but keeps valid ones", () => {
    const block = buildFactsBlock([hazard(1), { garbage: true }, healthFact(2, { topic: "health.fact.updated" })])!;
    expect(block).toContain("radiation");
    expect(block).toContain("spo2");
  });

  it("skips rows whose payload fails its topic schema", () => {
    const bad = hazard(1, { payload: { hazard: "radiation" } });
    expect(buildFactsBlock([bad])).toBeNull();
  });

  it("hard caps the number of lines", () => {
    const events = Array.from({ length: 20 }, (_, i) => healthFact(i + 1));
    const block = buildFactsBlock(events, { maxLines: 3 })!;
    expect(block.split("\n")).toHaveLength(3);
  });

  it("hard caps total characters", () => {
    const long = healthFact(1, { summary: "y".repeat(500) });
    const events = Array.from({ length: 20 }, (_, i) => ({ ...long, id: i + 1 }));
    const block = buildFactsBlock(events, { maxChars: 200 })!;
    expect(block.length).toBeLessThanOrEqual(200);
  });

  it("collapses newlines inside summaries into one line", () => {
    const block = buildFactsBlock([hazard(1, { summary: "line1\nline2" })])!;
    expect(block).not.toContain("\nline2");
    expect(block.split("\n")).toHaveLength(1);
  });
});
