import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASTRONAUTS } from "~/features/astronaut";
import { CREW_FIXTURE, positionsAt } from "./crew-positions";

// The manifest is the ground truth for where the station actually sits in world space; the
// fixture waypoints are illustrative, so the test keeps them pinned to the geometry.
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

type Vec3 = readonly [number, number, number];

function inside(bounds: ManifestBounds, point: Vec3): boolean {
  return [0, 1, 2].every(
    (axis) => point[axis]! >= bounds.min[axis]! && point[axis]! <= bounds.max[axis]!,
  );
}

function insideAnyPart(point: Vec3): boolean {
  return manifest.parts.some((part) => inside(part.bounds, point));
}

/** Bounds that contain every streamed part (the manifest has no top-level box). */
function combinedBounds(parts: readonly ManifestPart[]): ManifestBounds {
  return {
    min: [0, 1, 2].map((axis) => Math.min(...parts.map((part) => part.bounds.min[axis]!))) as [number, number, number],
    max: [0, 1, 2].map((axis) => Math.max(...parts.map((part) => part.bounds.max[axis]!))) as [number, number, number],
  };
}

/** Every waypoint of every patrol loop. */
const WAYPOINTS: ReadonlyArray<{ readonly fixture: string; readonly point: Vec3 }> =
  CREW_FIXTURE.flatMap((fixture) =>
    fixture.waypoints.map((point) => ({ fixture: fixture.astronautId, point })),
  );

/** Dense samples along every leg of every closed loop (leg i → i+1 mod N). */
function* sampleLegs(step = 0.5): Generator<{ fixture: string; point: Vec3 }> {
  for (const fixture of CREW_FIXTURE) {
    const waypoints = fixture.waypoints;
    for (let i = 0; i < waypoints.length; i += 1) {
      const from = waypoints[i]!;
      const to = waypoints[(i + 1) % waypoints.length]!;
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const dz = to[2] - from[2];
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const steps = Math.max(2, Math.ceil(length / step));
      for (let sIndex = 1; sIndex <= steps; sIndex += 1) {
        const s = sIndex / steps;
        yield {
          fixture: fixture.astronautId,
          point: [from[0] + dx * s, from[1] + dy * s, from[2] + dz * s],
        };
      }
    }
  }
}

describe("positionsAt", () => {
  it("is deterministic — the same instant yields the same positions", () => {
    expect(positionsAt(12.5)).toEqual(positionsAt(12.5));
    expect(positionsAt(0)).toEqual(positionsAt(0));
  });

  it("reports every position with a walk|hold phase, finite coordinates, any time", () => {
    for (const t of [0, 1.7, 12.3, 250, 3600, Number.NaN]) {
      const resolved = positionsAt(t);
      expect(resolved).toHaveLength(CREW_FIXTURE.length);
      for (const position of resolved) {
        expect(Number.isFinite(position.x)).toBe(true);
        expect(Number.isFinite(position.y)).toBe(true);
        expect(Number.isFinite(position.z)).toBe(true);
        expect(["walk", "hold"]).toContain(position.phase);
      }
    }
  });

  it("returns the anchors exactly in static (reduced-motion) mode, at any time", () => {
    for (const t of [0, 5, 1234.5]) {
      const resolved = positionsAt(t, { static: true });
      expect(resolved).toHaveLength(CREW_FIXTURE.length);
      for (const [index, fixture] of CREW_FIXTURE.entries()) {
        const position = resolved[index]!;
        expect([position.x, position.y, position.z]).toEqual([...fixture.anchor]);
        expect(position.phase).toBe("hold");
      }
    }
  });

  it("never leaves the streamed hull — every resolved position sits inside a streamed part", () => {
    for (let t = 0; t <= 180; t += 0.25) {
      for (const position of positionsAt(t)) {
        expect(
          insideAnyPart([position.x, position.y, position.z]),
          `${position.astronautId} at t=${t} (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`,
        ).toBe(true);
      }
    }
  });

  it("walks the loop — over a full lap each crew member covers real distance", () => {
    // Sample over 180 s (every cycle is shorter, including the phase offset); the max
    // displacement from the home anchor must exceed the old ±0.5 m bob by a lot.
    for (const fixture of CREW_FIXTURE) {
      let maxDistance = 0;
      for (let t = 0; t <= 180; t += 0.25) {
        const position = positionsAt(t).find((entry) => entry.astronautId === fixture.astronautId)!;
        const dx = position.x - fixture.anchor[0];
        const dy = position.y - fixture.anchor[1];
        const dz = position.z - fixture.anchor[2];
        maxDistance = Math.max(maxDistance, Math.sqrt(dx * dx + dy * dy + dz * dz));
      }
      expect(maxDistance, `${fixture.astronautId} should actually move`).toBeGreaterThan(2);
    }
  });

  it("stops — every crew member stands still at a waypoint during their cycle", () => {
    // A full lap always contains each waypoint's dwell, so "hold" must appear for all six.
    for (const fixture of CREW_FIXTURE) {
      let sawHold = false;
      let sawWalk = false;
      for (let t = 0; t <= 180; t += 0.25) {
        const phase = positionsAt(t).find((entry) => entry.astronautId === fixture.astronautId)!.phase;
        sawHold = sawHold || phase === "hold";
        sawWalk = sawWalk || phase === "walk";
      }
      expect(
        sawHold && sawWalk,
        `${fixture.astronautId} should alternate walking and standing`,
      ).toBe(true);
    }
  });
});

describe("CREW_FIXTURE", () => {
  it("covers exactly the fictional roster, one entry per crew member", () => {
    expect(CREW_FIXTURE.map((fixture) => fixture.astronautId).sort()).toEqual(
      ASTRONAUTS.map((astronaut) => astronaut.id).sort(),
    );
  });

  it("keeps the home anchor equal to the first waypoint", () => {
    for (const fixture of CREW_FIXTURE) {
      expect(fixture.anchor).toEqual(fixture.waypoints[0]);
    }
  });

  it("places every waypoint inside at least one streamed part", () => {
    for (const { fixture, point } of WAYPOINTS) {
      expect(insideAnyPart(point), `${fixture} waypoint ${point.join(",")}`).toBe(true);
    }
  });

  it("places every waypoint inside the combined streamed-manifest bounds", () => {
    const bounds = combinedBounds(manifest.parts);
    for (const { fixture, point } of WAYPOINTS) {
      expect(inside(bounds, point), `${fixture} waypoint ${point.join(",")}`).toBe(true);
    }
  });

  it("keeps every leg inside the streamed hull (dense samples)", () => {
    for (const { fixture, point } of sampleLegs(0.5)) {
      expect(
        insideAnyPart(point),
        `${fixture} leg sample ${point.map((v) => v.toFixed(2)).join(",")}`,
      ).toBe(true);
    }
  });

  it("defines a walkable loop: 3+ waypoints, positive speed, non-negative dwells, bob ≤ 0.15", () => {
    for (const fixture of CREW_FIXTURE) {
      expect(fixture.waypoints.length).toBeGreaterThanOrEqual(3);
      expect(fixture.speed).toBeGreaterThan(0);
      expect(fixture.speed).toBeLessThanOrEqual(2);
      expect(fixture.dwell).toHaveLength(fixture.waypoints.length);
      for (const dwell of fixture.dwell) {
        expect(dwell).toBeGreaterThanOrEqual(0);
      }
      expect(fixture.bob.radius).toBeGreaterThan(0);
      expect(fixture.bob.radius).toBeLessThanOrEqual(0.15);
    }
  });
});
