import { describe, it, expect } from "vitest";
import { calculateRms, smoothEnvelope, waveformPath } from "./WaveformModel";

describe("calculateRms", () => {
  it("returns 0 for empty", () => {
    expect(calculateRms(new Float32Array(0))).toBe(0);
  });
  it("clamps", () => {
    expect(calculateRms([1, 1])).toBeLessThanOrEqual(1);
  });
  it("nonzero for signal", () => {
    expect(calculateRms([0.5, -0.5])).toBeGreaterThan(0);
  });
});

describe("smoothEnvelope", () => {
  it("attacks up", () => {
    const v = smoothEnvelope(0, 1, 0.5, 0.1);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
  it("releases down", () => {
    const v = smoothEnvelope(1, 0, 0.5, 0.1);
    expect(v).toBeLessThan(1);
  });
});

describe("waveformPath", () => {
  it("starts with M", () => {
    expect(waveformPath(269, 47, 0.2, 0).startsWith("M")).toBe(true);
  });
  it("contains L", () => {
    expect(waveformPath(269, 47, 0.2, 0)).toContain("L");
  });
});