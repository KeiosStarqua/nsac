import { describe, it, expect } from "vitest";
import {
  boxCenter,
  boxRadius,
  boxSize,
  frameBox,
  framingDistance,
  type Box3Like,
} from "./framing";

const bodyBox: Box3Like = { min: [-0.333, 0, -0.146], max: [0.333, 1.719, 0.146] };
const heartBox: Box3Like = { min: [-0.036, 1.252, -0.031], max: [0.08, 1.358, 0.076] };
const flatBox: Box3Like = { min: [0, 0, 0], max: [0, 0, 0] };

const FOV = 38;

/** Angle the box's bounding sphere subtends from the camera. */
function subtendedAngle(radius: number, distance: number): number {
  return 2 * Math.asin(Math.min(1, radius / distance));
}

describe("framing", () => {
  it("returns a finite centre, size and radius", () => {
    expect(boxCenter(bodyBox).every(Number.isFinite)).toBe(true);
    expect(boxSize(bodyBox)).toEqual([0.666, 1.719, 0.292]);
    expect(boxRadius(bodyBox)).toBeCloseTo(Math.hypot(0.666, 1.719, 0.292) / 2, 6);
  });

  it("frames the whole body inside a landscape frustum", () => {
    const framing = frameBox(bodyBox, { fovDeg: FOV, aspect: 16 / 10, padding: 1.1 });
    expect(framing.target.every(Number.isFinite)).toBe(true);
    expect(framing.position.every(Number.isFinite)).toBe(true);
    expect(framing.distance).toBeGreaterThan(0);
    const halfVertical = ((FOV * Math.PI) / 180) / 2;
    expect(subtendedAngle(boxRadius(bodyBox), framing.distance)).toBeLessThanOrEqual(
      2 * halfVertical + 1e-9,
    );
  });

  it("frames the whole body inside a portrait frustum", () => {
    const aspect = 0.56;
    const framing = frameBox(bodyBox, { fovDeg: FOV, aspect, padding: 1.1 });
    const halfVertical = ((FOV * Math.PI) / 180) / 2;
    const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
    expect(subtendedAngle(boxRadius(bodyBox), framing.distance)).toBeLessThanOrEqual(
      2 * halfHorizontal + 1e-9,
    );
  });

  it("moves closer to a small structure than to the whole body", () => {
    const body = framingDistance(bodyBox, FOV);
    const heart = framingDistance(heartBox, FOV);
    expect(Number.isFinite(heart)).toBe(true);
    expect(heart).toBeGreaterThan(0);
    expect(heart).toBeLessThan(body);
  });

  it("places the camera along the requested direction", () => {
    const framing = frameBox(heartBox, { fovDeg: FOV, direction: [0, 0, 2] });
    expect(framing.position[0]).toBeCloseTo(framing.target[0], 6);
    expect(framing.position[1]).toBeCloseTo(framing.target[1], 6);
    expect(framing.position[2]).toBeGreaterThan(framing.target[2]);
  });

  it("survives a degenerate box and a zero direction", () => {
    const framing = frameBox(flatBox, { fovDeg: FOV, direction: [0, 0, 0] });
    expect(Number.isFinite(framing.distance)).toBe(true);
    expect(framing.distance).toBeGreaterThan(0);
    expect(framing.position.every(Number.isFinite)).toBe(true);
    expect(framing.position[2]).toBeGreaterThan(framing.target[2]);
  });
});
