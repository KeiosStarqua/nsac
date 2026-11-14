import { describe, it, expect } from "vitest";
import { buildHudFacts } from "./facts";
import { HUD_FACT_IDS } from "./names";
import { VITAL_VALUES, DETAILS } from "~/features/sky-hud/vitals";

describe("buildHudFacts", () => {
  const facts = buildHudFacts();

  it("builds exactly the HUD fact ids", () => {
    expect(Object.keys(facts).sort()).toEqual([...HUD_FACT_IDS].sort());
  });
  it("carries the fixture values, not invented ones", () => {
    expect(facts.heartRate.segments[0]?.value).toBe(VITAL_VALUES.heartRate);
    expect(facts.respiration.segments[0]?.value).toBe(VITAL_VALUES.respiration);
    expect(facts.spo2.segments[0]?.value).toBe(VITAL_VALUES.spo2);
    expect(facts.sleep.segments.map((s) => s.value)).toEqual([VITAL_VALUES.sleepHours, VITAL_VALUES.sleepMinutes]);
    expect(facts.missionDay.segments[0]?.value).toBe(DETAILS.mission.value);
  });
  it("every segment is a finite value or a non-empty string", () => {
    for (const fact of Object.values(facts)) {
      expect(fact.segments.length).toBeGreaterThan(0);
      for (const segment of fact.segments) {
        if (typeof segment.value === "number") expect(Number.isFinite(segment.value)).toBe(true);
        else expect(segment.value.length).toBeGreaterThan(0);
      }
      expect(fact.aria.length).toBeGreaterThan(0);
    }
  });
});
