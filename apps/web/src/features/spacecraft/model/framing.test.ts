import { describe, it, expect } from "vitest";
import {
  boxCenter,
  boxRadius,
  boxSize,
  frameBox,
  framingDistance,
  projectedExtents,
  viewBasis,
  type Box3Like,
} from "./framing";

// Rough bounding box of the ISS (metres): ~110 m long truss.
const issBox: Box3Like = { min: [-55, -22, -18], max: [55, 22, 18] };
const degenerate: Box3Like = { min: [0, 0, 0], max: [0, 0, 0] };

const FOV = 38;
const DIRECTION: [number, number, number] = [0.85, 0.42, 1];

/** Project a box corner onto the view plane using the same basis as framing.ts. */
function projectCorners(box: Box3Like, direction: [number, number, number]) {
  const { right, up } = viewBasis(direction);
  const center = boxCenter(box);
  const corners: Array<{ x: number; y: number }> = [];
  for (const x of [box.min[0], box.max[0]]) {
    for (const y of [box.min[1], box.max[1]]) {
      for (const z of [box.min[2], box.max[2]]) {
        const offset = [x - center[0], y - center[1], z - center[2]] as const;
        corners.push({
          x: offset[0] * right[0] + offset[1] * right[1] + offset[2] * right[2],
          y: offset[0] * up[0] + offset[1] * up[1] + offset[2] * up[2],
        });
      }
    }
  }
  return corners;
}

describe("framing", () => {
  it("returns a finite centre, size and radius for the ISS box", () => {
    expect(boxCenter(issBox)).toEqual([0, 0, 0]);
    expect(boxSize(issBox)).toEqual([110, 44, 36]);
    expect(boxRadius(issBox)).toBeCloseTo(Math.hypot(110, 44, 36) / 2, 6);
  });

  it("view basis is orthonormal and orthogonal to the view direction", () => {
    const { right, up } = viewBasis(DIRECTION);
    const dot = (a: readonly number[], b: readonly number[]) =>
      a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
    expect(dot(right, right)).toBeCloseTo(1, 6);
    expect(dot(up, up)).toBeCloseTo(1, 6);
    expect(dot(right, up)).toBeCloseTo(0, 6);
    const forward = DIRECTION.map((v) => v / Math.hypot(...DIRECTION));
    expect(dot(right, forward)).toBeCloseTo(0, 6);
    expect(dot(up, forward)).toBeCloseTo(0, 6);
  });

  it("projects every corner into the reported half-extents", () => {
    const { halfWidth, halfHeight } = projectedExtents(issBox, DIRECTION);
    for (const corner of projectCorners(issBox, DIRECTION)) {
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(halfWidth + 1e-9);
      expect(Math.abs(corner.y)).toBeLessThanOrEqual(halfHeight + 1e-9);
    }
  });

  it("frames the whole silhouette inside a landscape frustum", () => {
    const aspect = 16 / 10;
    const padding = 1.2;
    const framing = frameBox(issBox, { fovDeg: FOV, aspect, padding, direction: DIRECTION });
    expect(framing.position.every(Number.isFinite)).toBe(true);
    expect(framing.distance).toBeGreaterThan(0);
    const halfVertical = ((FOV * Math.PI) / 180) / 2;
    const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
    for (const corner of projectCorners(issBox, DIRECTION)) {
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(Math.tan(halfHorizontal) * framing.distance + 1e-9);
      expect(Math.abs(corner.y)).toBeLessThanOrEqual(Math.tan(halfVertical) * framing.distance + 1e-9);
    }
    // Padding leaves room around the silhouette instead of touching the frame.
    expect(framing.distance).toBeGreaterThan(
      framingDistance(issBox, FOV, 1, aspect, DIRECTION),
    );
  });

  it("frames the whole silhouette inside a portrait frustum", () => {
    const aspect = 0.46; // 390×844 phone
    const framing = frameBox(issBox, { fovDeg: FOV, aspect, padding: 1.2, direction: DIRECTION });
    const halfVertical = ((FOV * Math.PI) / 180) / 2;
    const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
    for (const corner of projectCorners(issBox, DIRECTION)) {
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(Math.tan(halfHorizontal) * framing.distance + 1e-9);
      expect(Math.abs(corner.y)).toBeLessThanOrEqual(Math.tan(halfVertical) * framing.distance + 1e-9);
    }
  });

  it("fills the narrow axis more tightly than the old sphere fit did", () => {
    const aspect = 16 / 10;
    const projected = framingDistance(issBox, FOV, 1, aspect, DIRECTION);
    const sphere = boxRadius(issBox) / Math.sin(((FOV * Math.PI) / 180) / 2);
    expect(projected).toBeLessThan(sphere);
  });

  it("survives a degenerate box", () => {
    const framing = frameBox(degenerate, { fovDeg: FOV, direction: DIRECTION });
    expect(Number.isFinite(framing.distance)).toBe(true);
    expect(framing.distance).toBe(2.6); // FALLBACK_DISTANCE
    expect(framingDistance(degenerate, FOV, 1.4, 1, DIRECTION)).toBe(2.6);
  });
});
