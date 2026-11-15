// Where the six fictional crew members are on the station — a *fixture*, not telemetry.
// Nothing here is measured, broadcast or derived from real crew data (HKT hard rule: fictional
// crew only, and every surface that shows these markers says "POSITIONS SIMULATED").
//
// Pure by design (no React, no three.js, no DOM) so vitest covers the drift maths. Anchors are
// world-space positions inside or beside the named module of `ISS-stationary.glb`; they are
// verified against the streamed manifest's part bounds in `crew-positions.test.ts`.

/** A crew member parked in a module, with the idle float that keeps a marker alive. */
export interface CrewPositionFixture {
  readonly astronautId: string;
  /** English fixture label of the module the marker sits in (never rendered in the DOM). */
  readonly module: string;
  /** World-space centre of the idle drift, in the station's own coordinates. */
  readonly anchor: readonly [number, number, number];
  readonly drift: {
    /** World units of travel on each axis at most (0.5 ≈ half a metre at the model's scale). */
    readonly radius: number;
    /** Angular speed per axis, rad/s. */
    readonly axisSpeeds: readonly [number, number, number];
    /** Fixed phases (rad) — fixed so the motion is deterministic, not random. */
    readonly phases: readonly [number, number, number];
  };
}

/** A resolved marker position for one crew member at one instant. */
export interface CrewResolvedPosition {
  readonly astronautId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly module: string;
}

/**
 * Six fixtures, one per entry of `ASTRONAUTS` in `features/astronaut`. The module labels are
 * illustrative assignments for the demo; the anchors line up with `public/models/iss/streamed`
 * part bounds (Unity/Destiny, Mobile Base System, Zvezda, Columbus, Kibo, Tranquility/Cupola).
 */
export const CREW_FIXTURE: readonly CrewPositionFixture[] = [
  {
    astronautId: "ayla-reyes",
    module: "Unity/Destiny — Lab",
    anchor: [1.2, 3.6, 4.2],
    drift: { radius: 0.5, axisSpeeds: [0.42, 0.37, 0.51], phases: [0.2, 1.7, 4.1] },
  },
  {
    astronautId: "dae-jung-park",
    module: "Mobile Base — Robotics",
    anchor: [-8.6, 11.8, 10.2],
    drift: { radius: 0.5, axisSpeeds: [0.51, 0.44, 0.36], phases: [2.6, 0.9, 3.4] },
  },
  {
    astronautId: "lena-fischer",
    module: "Zvezda — Crew Quarters",
    anchor: [0.4, 0.2, -17.5],
    drift: { radius: 0.5, axisSpeeds: [0.36, 0.55, 0.47], phases: [5.2, 2.1, 0.6] },
  },
  {
    astronautId: "tomas-ortega",
    module: "Columbus — Science",
    anchor: [-7.6, 1.2, 16.1],
    drift: { radius: 0.5, axisSpeeds: [0.47, 0.6, 0.39], phases: [1.1, 4.6, 2.8] },
  },
  {
    astronautId: "yuki-tanaka",
    module: "Kibo — Science",
    anchor: [16.6, 1.0, 16.2],
    drift: { radius: 0.5, axisSpeeds: [0.58, 0.41, 0.53], phases: [3.9, 0.4, 5.7] },
  },
  {
    astronautId: "noor-abbasi",
    module: "Tranquility Cupola — Observation",
    anchor: [1.9, -6.2, 1.4],
    drift: { radius: 0.5, axisSpeeds: [0.44, 0.52, 0.35], phases: [0.8, 3.2, 1.9] },
  },
];

/** The vertical drift is scaled down so a marker floats *along* a module instead of bobbing. */
const Y_DRIFT_SCALE = 0.6;

export interface PositionsOptions {
  /** Reduced motion: every marker sits exactly on its anchor (no drift at all). */
  readonly static?: boolean;
}

/**
 * Deterministic idle drift: `anchor + radius · [sin(t·sx + px), sin(t·sy + py)·0.6, sin(t·sz + pz)]`.
 *
 * No `Math.random()` — the phases are baked into the fixture, so the same `t` always yields the
 * same positions (and a screenshot of a given instant is reproducible). With `static: true` the
 * anchors come back untouched, which is the reduced-motion path the scene takes.
 */
export function positionsAt(
  timeSeconds: number,
  options: PositionsOptions = {},
): readonly CrewResolvedPosition[] {
  if (options.static) {
    return CREW_FIXTURE.map((fixture) => ({
      astronautId: fixture.astronautId,
      x: fixture.anchor[0],
      y: fixture.anchor[1],
      z: fixture.anchor[2],
      module: fixture.module,
    }));
  }
  const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  return CREW_FIXTURE.map((fixture) => {
    const { radius, axisSpeeds, phases } = fixture.drift;
    return {
      astronautId: fixture.astronautId,
      x: fixture.anchor[0] + radius * Math.sin(t * axisSpeeds[0] + phases[0]),
      y: fixture.anchor[1] + radius * Math.sin(t * axisSpeeds[1] + phases[1]) * Y_DRIFT_SCALE,
      z: fixture.anchor[2] + radius * Math.sin(t * axisSpeeds[2] + phases[2]),
      module: fixture.module,
    };
  });
}
