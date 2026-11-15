import { describe, it, expect } from "vitest";
import {
  INJECTABLE_TOPICS,
  EVENT_TOPICS,
  buildFactsBlock,
  changeEventSchema,
  hazardDetectedPayloadSchema,
  medicalFindingCreatedPayloadSchema,
  medicalFindingResolvedPayloadSchema,
  medicalReviewRequestedPayloadSchema,
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

const derivedFactPayload = (overrides: Record<string, unknown> = {}) => ({
  factId: "fact-1",
  missionId: "SIM-001",
  crewId: "ayla-reyes",
  category: "radiation",
  rule: "radiation_burst",
  status: "active",
  severity: "yellow",
  sourceMode: "synthetic",
  quality: "valid",
  observedAt: "2026-11-16T09:10:00.000Z",
  evidenceEventIds: ["evt-1", "evt-2"],
  ...overrides,
});

const derivedFact = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  astronautId: "ayla-reyes",
  topic: "health.fact.updated",
  source: "simulation",
  summary: "Dose rate 30.7 µSv/h ≈ 61.6× mission trailing median (simulated burst; SRAG context, not an exposure limit)",
  payload: derivedFactPayload(),
  createdAt: 1_700_000_000_000 + id,
  ...overrides,
});


describe("event schemas (wire-mirror)", () => {
  it("EVENT_TOPICS carries the backend topics; INJECTABLE_TOPICS stays exactly the original three", () => {
    expect(EVENT_TOPICS).toEqual([
      "hazard.detected",
      "health.fact.updated",
      "claims.changed",
      "agent.turn.completed",
      "medical.finding.created",
      "medical.finding.resolved",
      "medical.review.requested",
    ]);
    // Medical data minimization: clinical events are never injected into agent prompts.
    expect(INJECTABLE_TOPICS).toEqual(["hazard.detected", "health.fact.updated", "claims.changed"]);
    for (const medical of ["medical.finding.created", "medical.finding.resolved", "medical.review.requested"]) {
      expect(INJECTABLE_TOPICS).not.toContain(medical);
    }
    expect(INJECTABLE_TOPICS).not.toContain("agent.turn.completed");
  });

  it("medical.* payload schemas validate", () => {
    expect(
      medicalFindingCreatedPayloadSchema.safeParse({
        findingId: "f-1",
        specialistId: "sky-cardio",
        severity: "yellow",
        requiresMedicalReview: false,
      }).success,
    ).toBe(true);
    expect(
      medicalFindingCreatedPayloadSchema.safeParse({
        findingId: "f-1",
        specialistId: "sky-cardio",
        severity: "orange",
        requiresMedicalReview: false,
      }).success,
    ).toBe(false);
    expect(
      medicalFindingResolvedPayloadSchema.safeParse({ findingId: "f-1", action: "resolved" }).success,
    ).toBe(true);
    expect(
      medicalFindingResolvedPayloadSchema.safeParse({ findingId: "f-1", action: "reviewed" }).success,
    ).toBe(false);
    expect(medicalReviewRequestedPayloadSchema.safeParse({ reason: "officer synthesis flagged review" }).success).toBe(
      true,
    );
    expect(medicalReviewRequestedPayloadSchema.safeParse({ reason: "" }).success).toBe(false);
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
  it("never injects medical.* events into buildFactsBlock (medical data minimization)", () => {
    const medical = {
      id: 9,
      astronautId: "ayla-reyes",
      topic: "medical.finding.created",
      source: "clinical-engine",
      summary: "red severity finding",
      payload: { findingId: "f-1", specialistId: "sky-cardio", severity: "red", requiresMedicalReview: true },
      createdAt: 1_700_000_000_009,
    };
    expect(buildFactsBlock([medical])).toBeNull();
    const block = buildFactsBlock([claim(1), medical])!;
    expect(block).toContain("claims");
    expect(block).not.toContain("medical");
    expect(block).not.toContain("finding");
  });

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

describe("health.fact.updated union (legacy v1 + simulator v2)", () => {
  it("renders a legacy v1 fact byte-identically to before", () => {
    const block = buildFactsBlock([healthFact(1)])!;
    expect(block).toBe("- [info|spo2] spo2: 97 % (source: osdr-feed)");
    const withSeverity = buildFactsBlock([
      healthFact(1, { payload: { fact: "spo2", value: 97, unit: "%", severity: "yellow" } }),
    ])!;
    expect(withSeverity).toBe("- [yellow|spo2] spo2: 97 % (source: osdr-feed)");
  });

  it("renders a v2 fact as one line from the event summary, never the evidence ids", () => {
    const block = buildFactsBlock([derivedFact(1)])!;
    expect(block.split("\n")).toHaveLength(1);
    expect(block.startsWith("- [yellow|radiation_burst]")).toBe(true);
    expect(block).toBe(
      "- [yellow|radiation_burst] Dose rate 30.7 µSv/h ≈ 61.6× mission trailing median (simulated burst; SRAG context, not an exposure limit) (source: simulation)",
    );
    expect(block).not.toContain("evt-1");
    expect(block).not.toContain("evt-2");
  });

  it("falls back to `rule: status` when the v2 event row carries no summary", () => {
    const block = buildFactsBlock([derivedFact(1, { summary: null })])!;
    expect(block).toBe("- [yellow|radiation_burst] radiation_burst: active (source: simulation)");
  });

  it("accepts crew-scoped and mission-scoped v2 rows (astronautId may be null)", () => {
    const crewScoped = buildFactsBlock([derivedFact(1)])!;
    const missionScoped = buildFactsBlock([
      derivedFact(1, { astronautId: null, payload: derivedFactPayload({ crewId: undefined }) }),
    ])!;
    expect(crewScoped.startsWith("- [yellow|radiation_burst]")).toBe(true);
    expect(missionScoped).toBe(crewScoped);
  });

  it("renders a resolved v2 fact with source: simulation", () => {
    const block = buildFactsBlock([
      derivedFact(1, { summary: "Radiation burst resolved; dose rate back to baseline", payload: derivedFactPayload({ status: "resolved" }) }),
    ])!;
    expect(block).toBe(
      "- [yellow|radiation_burst] Radiation burst resolved; dose rate back to baseline (source: simulation)",
    );
  });

  it("skips a malformed v2 row silently and still builds from the rest", () => {
    const malformed = derivedFact(2, { payload: derivedFactPayload({ evidenceEventIds: undefined }) });
    expect(buildFactsBlock([malformed])).toBeNull();
    const block = buildFactsBlock([claim(1), malformed, healthFact(3)])!;
    expect(block.split("\n")).toHaveLength(2);
    expect(block).toContain("claims");
    expect(block).toContain("spo2");
    expect(block).not.toContain("radiation_burst");
  });
});
