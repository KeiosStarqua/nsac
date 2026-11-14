import { describe, it, expect } from "vitest";
import { partSphere, projectedPixelRadius } from "./iss-relevance";
import type { ISSStreamPart } from "./iss-types";

const basePart: ISSStreamPart = {
  id: "test",
  url: "/models/iss/streamed/parts/test.gltf",
  bytes: 1000,
  geometryBytes: 500,
  textureBytes: 0,
  textures: [],
  bounds: { min: [-10, -5, -2], max: [10, 5, 2] },
  nodes: 1,
};

describe("partSphere", () => {
  it("centres on the bounds centre and encloses the corners", () => {
    const s = partSphere(basePart);
    expect(s.center).toEqual([0, 0, 0]);
    expect(s.radius).toBeCloseTo(Math.sqrt(10 * 10 + 5 * 5 + 2 * 2), 5);
  });

  it("handles asymmetric bounds", () => {
    const s = partSphere({ ...basePart, bounds: { min: [4, 0, -1], max: [12, 8, 5] } });
    expect(s.center).toEqual([8, 4, 2]);
    expect(s.radius).toBeCloseTo(Math.sqrt(4 * 4 + 4 * 4 + 3 * 3), 5);
  });
});

describe("projectedPixelRadius", () => {
  const height = 941;
  const fov = 38;

  it("returns Infinity for a zero distance (camera inside the part)", () => {
    expect(projectedPixelRadius(5, 0, fov, height)).toBe(Number.POSITIVE_INFINITY);
  });

  it("grows as the camera approaches", () => {
    const far = projectedPixelRadius(5, 200, fov, height);
    const near = projectedPixelRadius(5, 40, fov, height);
    expect(near).toBeGreaterThan(far);
  });

  it("shrinks linearly with distance for small spheres", () => {
    const a = projectedPixelRadius(2, 100, fov, height);
    const b = projectedPixelRadius(2, 200, fov, height);
    expect(a / b).toBeCloseTo(2, 3);
  });

  it("matches the analytic formula", () => {
    const d = 120;
    const r = 6;
    const expected = (r / (Math.tan((fov * Math.PI) / 360) * d)) * (height / 2);
    expect(projectedPixelRadius(r, d, fov, height)).toBeCloseTo(expected, 6);
  });
});
