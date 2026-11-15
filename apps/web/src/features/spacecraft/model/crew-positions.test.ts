import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASTRONAUTS } from "~/features/astronaut";
import { CREW_FIXTURE, positionsAt } from "./crew-positions";

// The manifest is the ground truth for where the station actually sits in world space; the
// fixture anchors are illustrative, so the test keeps them pinned to the geometry.
const MANIFEST_PATH = "public/models/iss/streamed/manifest.json";

interface ManifestBounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

interface ManifestPart {
  readonly id: string;
  readonly bounds: ManifestBounds;
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as { parts: ManifestPart[] };

/** Bounds that contain every streamed part (the manifest has no top-level box). */
function combinedBounds(parts: readonly ManifestPart[]): ManifestBounds {
  return {
    min: [0, 1, 2].map((axis) => Math.min(...parts.map((part) => part.bounds.min[axis]!))) as [number, number, number],
    max: [0, 1, 2].map((axis) => Math.max(...parts.map((part) => part.bounds.max[axis]!))) as [number, number, number],
  };
}

function inside(bounds: ManifestBounds, point: readonly [number, number, number]): boolean {
  return [0, 1, 2].every(
    (axis) => point[axis]! >= bounds.min[axis]! && point[axis]! <= bounds.max[axis]!,
  );
}

describe("positionsAt", () => {
  it("is deterministic — the same instant yields the same positions", () => {
    expect(positionsAt(12.5)).toEqual(positionsAt(12.5));
    expect(positionsAt(0)).toEqual(positionsAt(0));
  });

  it("keeps every drifted position within the drift radius of its anchor", () => {
    for (const t of [0, 1.7, 12.3, 250, 3600]) {
      const resolved = positionsAt(t);
      expect(resolved).toHaveLength(CREW_FIXTURE.length);
      for (const [index, fixture] of CREW_FIXTURE.entries()) {
        const position = resolved[index]!;
        expect(position.astronautId).toBe(fixture.astronautId);
        expect(position.module).toBe(fixture.module);
        // sin ≤ 1 on each axis, and y is additionally scaled by 0.6.
        expect(Math.abs(position.x - fixture.anchor[0])).toBeLessThanOrEqual(fixture.drift.radius + 1e-12);
        expect(Math.abs(position.y - fixture.anchor[1])).toBeLessThanOrEqual(fixture.drift.radius + 1e-12);
        expect(Math.abs(position.z - fixture.anchor[2])).toBeLessThanOrEqual(fixture.drift.radius + 1e-12);
      }
    }
  });

  it("yields finite numbers at t = 0", () => {
    for (const position of positionsAt(0)) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
      expect(Number.isFinite(position.z)).toBe(true);
    }
  });

  it("returns the anchors exactly in static (reduced-motion) mode, at any time", () => {
    for (const t of [0, 5, 1234.5]) {
      const resolved = positionsAt(t, { static: true });
      expect(resolved).toHaveLength(CREW_FIXTURE.length);
      for (const [index, fixture] of CREW_FIXTURE.entries()) {
        const position = resolved[index]!;
        expect([position.x, position.y, position.z]).toEqual([...fixture.anchor]);
      }
    }
  });

  it("survives a non-finite instant without producing NaN", () => {
    for (const position of positionsAt(Number.NaN)) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
      expect(Number.isFinite(position.z)).toBe(true);
    }
  });
});

describe("CREW_FIXTURE", () => {
  it("covers exactly the fictional roster, one entry per crew member", () => {
    expect(CREW_FIXTURE.map((fixture) => fixture.astronautId).sort()).toEqual(
      ASTRONAUTS.map((astronaut) => astronaut.id).sort(),
    );
  });

  it("places every anchor inside the combined streamed-manifest bounds", () => {
    const bounds = combinedBounds(manifest.parts);
    for (const fixture of CREW_FIXTURE) {
      expect(inside(bounds, fixture.anchor), `${fixture.astronautId} @ ${fixture.module}`).toBe(true);
    }
  });

  it("places every anchor inside at least one streamed part", () => {
    for (const fixture of CREW_FIXTURE) {
      const host = manifest.parts.some((part) => inside(part.bounds, fixture.anchor));
      expect(host, `${fixture.astronautId} should sit in a module, not empty space`).toBe(true);
    }
  });

  it("keeps the drift illustrative and bounded", () => {
    for (const fixture of CREW_FIXTURE) {
      expect(fixture.drift.radius).toBeGreaterThan(0);
      expect(fixture.drift.radius).toBeLessThanOrEqual(1);
      for (const speed of fixture.drift.axisSpeeds) {
        expect(speed).toBeGreaterThan(0);
        expect(speed).toBeLessThan(1);
      }
    }
  });
});
