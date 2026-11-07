import { describe, expect, it } from "vitest";
import {
  DemoSearchSchema,
  canConfirm,
  canFastForward,
  linkStateFor,
  snapshotFor,
  trajectory,
  type ScenarioParams,
} from "./readiness";

const params: ScenarioParams = { startDay: 170, endDay: 184, startScore: 62, endScore: 81 };

describe("trajectory", () => {
  const days = trajectory(params);

  it("covers every day and hits both endpoints exactly", () => {
    expect(days).toHaveLength(15);
    expect(days[0]).toMatchObject({ day: 170, score: 62, severity: "yellow" });
    expect(days.at(-1)).toMatchObject({ day: 184, score: 81, severity: "green" });
  });

  it("never decreases", () => {
    for (let i = 1; i < days.length; i++) {
      expect(days[i]!.score).toBeGreaterThanOrEqual(days[i - 1]!.score);
    }
  });

  it("returns a single final snapshot when the span is empty", () => {
    expect(trajectory({ ...params, endDay: 170 })).toEqual([snapshotFor("fastForwarded", { ...params, endDay: 170 })]);
  });
});

describe("stages", () => {
  it("only moves forward through confirm, then fast-forward", () => {
    expect(canConfirm("alert")).toBe(true);
    expect(canFastForward("alert")).toBe(false);
    expect(canFastForward("confirmed")).toBe(true);
    expect(canConfirm("confirmed")).toBe(false);
    expect(canFastForward("fastForwarded")).toBe(false);
  });

  it("queues nothing before Confirm", () => {
    expect(linkStateFor("alert")).toBe("idle");
    expect(linkStateFor("confirmed")).toBe("queued");
    expect(linkStateFor("fastForwarded")).toBe("delivered");
  });

  it("shows the matching score per stage", () => {
    expect(snapshotFor("alert", params).score).toBe(62);
    expect(snapshotFor("confirmed", params).score).toBe(62);
    expect(snapshotFor("fastForwarded", params).score).toBe(81);
  });
});

describe("DemoSearchSchema", () => {
  it("accepts a known stage", () => {
    expect(DemoSearchSchema.parse({ stage: "confirmed" })).toEqual({ stage: "confirmed" });
  });

  it("falls back to alert for anything else instead of throwing", () => {
    expect(DemoSearchSchema.parse({ stage: "hacked" })).toEqual({ stage: "alert" });
    expect(DemoSearchSchema.parse({})).toEqual({ stage: "alert" });
  });
});
