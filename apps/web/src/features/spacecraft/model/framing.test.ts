import { describe, it, expect } from "vitest";
import {
  boxCenter,
  boxRadius,
  boxSize,
  frameBox,
  framingDistance,
  type Box3Like,
} from "./framing";

// Rough bounding box of the ISS (metres): ~109 m long truss.
const issBox: Box3Like = { min: [-55, -22, -18], max: [55, 22, 18] };
const degenerate: Box3Like = { min: [0, 0, 0], max: [0, 0, 0] };

const FOV = 38;

/** Angle the box's bounding sphere subtends from the camera. */
function subtendedAngle(radius: number, distance: number): number {
  return 2 * Math.asin(Math.min(1, radius / distance));
}

describe("framing", () => {
  it("returns a finite centre, size and radius for the ISS box", () => {
    expect(boxCenter(issBox)).toEqual([0, 0, 0]);
    expect(boxSize(issBox)).toEqual([110, 44, 36]);
    expect(boxRadius(issBox)).toBeCloseTo(Math.hypot(110, 44, 36) / 2, 6);
  });

  it("frames the whole station inside a landscape frustum", () => {
    const framing = frameBox(issBox, { fovDeg: FOV, aspect: 16 / 10, padding: 1.2 });
    expect(framing.position.every(Number.isFinite)).toBe(true);
    expect(framing.distance).toBeGreaterThan(0);
    const halfVertical = ((FOV * Math.PI) / 180) / 2;
    expect(subtendedAngle(boxRadius(issBox), framing.distance)).toBeLessThanOrEqual(
      2 * halfVertical + 1e-9,
    );
  });

  it("frames the whole station inside a portrait frustum", () => {
    const aspect = 0.56;
    const framing = frameBox(issBox, { fovDeg: FOV, aspect, padding: 1.2 });
    const halfHorizontal = Math.atan(Math.tan(((FOV * Math.PI) / 180) / 2) * aspect);
    expect(subtendedAngle(boxRadius(issBox), framing.distance)).toBeLessThanOrEqual(
      2 * halfHorizontal + 1e-9,
    );
  });

  it("survives a degenerate box", () => {
    const framing = frameBox(degenerate, { fovDeg: FOV });
    expect(Number.isFinite(framing.distance)).toBe(true);
    expect(framing.distance).toBeGreaterThan(0);
    expect(framingDistance(degenerate, FOV)).toBeGreaterThan(0);
  });
});
