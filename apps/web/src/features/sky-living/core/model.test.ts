import { describe, it, expect } from "vitest";
import { lerp, clamp, easeInOut, angleToXY, normalizeAngle, shortestAngleDelta } from "./model";

describe("core model", () => {
  it("lerp", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });
  it("clamp", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
  });
  it("easeInOut boundaries", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
  });
  it("angleToXY at top", () => {
    const p = angleToXY(100, 100, 50, 0);
    expect(Math.round(p.x)).toBe(100);
    expect(Math.round(p.y)).toBe(50);
  });
  it("normalizeAngle", () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
  });
  it("shortestAngleDelta", () => {
    expect(shortestAngleDelta(350, 10)).toBe(20);
    expect(shortestAngleDelta(10, 350)).toBe(-20);
  });
});