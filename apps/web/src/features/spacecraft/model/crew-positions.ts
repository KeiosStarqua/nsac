// Where the six fictional crew members are on the station — a *fixture*, not telemetry.
// Nothing here is measured, broadcast or derived from real crew data (HKT hard rule: fictional
// crew only, and every surface that shows these markers says "POSITIONS SIMULATED").
//
// Pure by design (no React, no three.js, no DOM) so vitest covers the locomotion maths.
// Anchors and waypoints are world-space positions inside or beside the named module of
// `ISS-stationary.glb`; they are verified against the streamed manifest's part bounds in
// `crew-positions.test.ts` (every waypoint sits inside at least one streamed part, and dense
// samples along every leg stay inside the union of the parts).

/** A crew member patrolling a closed loop of waypoints, with dwell (standing) stops. */
export interface CrewPositionFixture {
  readonly astronautId: string;
  /** English fixture label of the module the patrol starts in (never rendered in the DOM). */
  readonly module: string;
  /**
   * World-space centre of the patrol, in the station's own coordinates. Always equal to
   * `waypoints[0]` — kept as the named "home" point for the reduced-motion path and the
   * first-frame position.
   */
  readonly anchor: readonly [number, number, number];
  /**
   * Closed patrol loop (world-space). The marker walks W0 → W1 → … → Wn-1 → W0 forever,
   * standing still for `dwell[i]` seconds at waypoint i each lap. 3+ waypoints per loop.
   * The loops follow the connected modules (Unity → Harmony, MBS, Zvezda, Columbus → Harmony,
   * Kibo → Harmony, Tranquility Cupola), so no leg crosses empty space.
   */
  readonly waypoints: readonly (readonly [number, number, number])[];
  /** Walking speed, world units/s (1 unit ≈ 1 m — a slow walk down the module). */
  readonly speed: number;
  /** Standing ("stopped") time per waypoint, seconds — the pause between walks. */
  readonly dwell: readonly number[];
  /** Offset into the patrol cycle (seconds), so the crew does not march in lockstep. */
  readonly phaseOffset: number;
  /** Subtle idle bob so a standing marker still reads as alive (world units, ≤ 0.15). */
  readonly bob: {
    readonly radius: number;
    /** Angular speed per axis, rad/s. */
    readonly axisSpeeds: readonly [number, number, number];
    /** Fixed phases (rad) — fixed so the motion is deterministic, not random. */
    readonly phases: readonly [number, number, number];
  };
}

/** How the marker is behaving at one instant: walking the loop, or standing at a waypoint. */
export type CrewPhase = "walk" | "hold";

/** A resolved marker position for one crew member at one instant. */
export interface CrewResolvedPosition {
  readonly astronautId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly module: string;
  /** `walk` while travelling a leg, `hold` while standing at a waypoint. */
  readonly phase: CrewPhase;
}

/**
 * Six fixtures, one per entry of `ASTRONAUTS` in `features/astronaut`. The module labels are
 * illustrative assignments for the demo; the waypoints line up with `public/models/iss/streamed`
 * part bounds (Unity/Destiny → Harmony, MBS-Robotics, Zvezda, Columbus → Harmony, Kibo →
 * Harmony, Tranquility/Cupola). Each loop is walked at a slow walking pace with a standing
 * pause at every waypoint — the crew is never idle in one spot, never rushed either.
 */
export const CREW_FIXTURE: readonly CrewPositionFixture[] = [
  {
    astronautId: "ayla-reyes",
    module: "Unity/Destiny — Lab",
    anchor: [1.2, 3.6, 4.2],
    waypoints: [
      [1.2, 3.6, 4.2],   // lab bench (home)
      [3.4, 4.6, 9.8],   // Unity aft, toward Harmony
      [0.6, 3.0, 14.8],  // Harmony node
    ],
    speed: 1.15,
    dwell: [5.0, 3.5, 6.0],
    phaseOffset: 0,
    bob: { radius: 0.12, axisSpeeds: [0.42, 0.37, 0.51], phases: [0.2, 1.7, 4.1] },
  },
  {
    astronautId: "dae-jung-park",
    module: "Mobile Base — Robotics",
    anchor: [-8.6, 11.8, 10.2],
    waypoints: [
      [-8.6, 11.8, 10.2],  // MBS centre (anchor/home)
      [-15.2, 13.2, 10.4], // MBS port end
      [-1.8, 8.2, 8.6],    // truss S0/S1 junction
    ],
    speed: 1.0,
    dwell: [6.5, 4.0, 3.0],
    phaseOffset: 7.3,
    bob: { radius: 0.12, axisSpeeds: [0.51, 0.44, 0.36], phases: [2.6, 0.9, 3.4] },
  },
  {
    astronautId: "lena-fischer",
    module: "Zvezda — Crew Quarters",
    anchor: [0.4, 0.2, -17.5],
    waypoints: [
      [0.4, 0.2, -17.5], // mid-deck (home)
      [-5.5, 1.8, -27.5], // aft quarters
      [5.0, -0.8, -8.0],  // forward, toward the Unity hatch
    ],
    speed: 1.25,
    dwell: [6.0, 4.0, 4.5],
    phaseOffset: 13.1,
    bob: { radius: 0.12, axisSpeeds: [0.36, 0.55, 0.47], phases: [5.2, 2.1, 0.6] },
  },
  {
    astronautId: "tomas-ortega",
    module: "Columbus — Science",
    anchor: [-7.6, 1.2, 16.1],
    waypoints: [
      [-7.6, 1.2, 16.1],  // Columbus lab bench (home)
      [-10.8, 1.6, 15.0], // Columbus port end
      [-3.2, 2.2, 13.2],  // Harmony node push
    ],
    speed: 0.9,
    dwell: [7.0, 4.0, 5.0],
    phaseOffset: 3.9,
    bob: { radius: 0.12, axisSpeeds: [0.47, 0.6, 0.39], phases: [1.1, 4.6, 2.8] },
  },
  {
    astronautId: "yuki-tanaka",
    module: "Kibo — Science",
    anchor: [16.6, 1.0, 16.2],
    waypoints: [
      [16.6, 1.0, 16.2],  // Kibo workbench (home)
      [20.5, 1.4, 18.0],  // Kibo +x end
      [10.5, 2.4, 13.0],  // Harmony node
    ],
    speed: 0.95,
    dwell: [5.5, 3.5, 4.5],
    phaseOffset: 17.7,
    bob: { radius: 0.12, axisSpeeds: [0.58, 0.41, 0.53], phases: [3.9, 0.4, 5.7] },
  },
  {
    astronautId: "noor-abbasi",
    module: "Tranquility Cupola — Observation",
    anchor: [1.9, -6.2, 1.4],
    waypoints: [
      [1.9, -6.2, 1.4],  // Cupola window (home)
      [6.5, -4.2, 4.0],  // Tranquility forward
      [-4.5, -2.6, -0.8], // Tranquility aft (Node 3)
    ],
    speed: 0.85,
    dwell: [8.0, 3.5, 3.5],
    phaseOffset: 10.4,
    bob: { radius: 0.12, axisSpeeds: [0.44, 0.52, 0.35], phases: [0.8, 3.2, 1.9] },
  },
];

/** The vertical bob is scaled down so a marker floats *along* a module instead of bobbing. */
const Y_BOB_SCALE = 0.6;

export interface PositionsOptions {
  /** Reduced motion: every marker sits exactly on its anchor (no walk, no bob at all). */
  readonly static?: boolean;
}

type Vec3 = readonly [number, number, number];

interface PreparedLeg {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly duration: number;
}

interface PreparedFixture {
  readonly fixture: CrewPositionFixture;
  /** legs[i] connects waypoint i → waypoint i+1 (mod N). */
  readonly legs: readonly PreparedLeg[];
  /** Cumulative event start times: [holdStart, legStart, holdStart, legStart, …]. */
  readonly dwell: readonly number[];
  readonly legDuration: readonly number[];
  /** Total cycle length in seconds (one full lap, including all dwells). */
  readonly total: number;
}

function legLength(from: Vec3, to: Vec3): number {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function prepare(fixture: CrewPositionFixture): PreparedFixture {
  const waypoints = fixture.waypoints;
  const legs: PreparedLeg[] = [];
  const legDuration: number[] = [];
  let total = 0;
  for (let i = 0; i < waypoints.length; i += 1) {
    const from = waypoints[i]!;
    const to = waypoints[(i + 1) % waypoints.length]!;
    const length = legLength(from, to);
    const duration = fixture.speed > 0 ? length / fixture.speed : 1;
    legs.push({ from, to, duration });
    legDuration.push(duration);
    total += fixture.dwell[i]! + duration;
  }
  return { fixture, legs, dwell: fixture.dwell, legDuration, total: total > 0 ? total : 1 };
}

const PREPARED: readonly PreparedFixture[] = CREW_FIXTURE.map(prepare);

/** smoothstep(u) — ease-in/out so the marker slows into and out of every waypoint. */
function smoothstep(u: number): number {
  const clamped = u < 0 ? 0 : u > 1 ? 1 : u;
  return clamped * clamped * (3 - 2 * clamped);
}

function bobOffset(bob: CrewPositionFixture["bob"], t: number): Vec3 {
  const { radius, axisSpeeds, phases } = bob;
  return [
    radius * Math.sin(t * axisSpeeds[0] + phases[0]),
    radius * Math.sin(t * axisSpeeds[1] + phases[1]) * Y_BOB_SCALE,
    radius * Math.sin(t * axisSpeeds[2] + phases[2]),
  ];
}

/**
 * Deterministic patrol locomotion: the marker walks its closed waypoint loop forever,
 * standing still for `dwell[i]` seconds at each waypoint. Legs ease in/out (smoothstep),
 * so the marker accelerates off a stop and glides into the next one. Standing is reported
 * as `phase: "hold"`, walking as `phase: "walk"` (a tiny deterministic bob is applied in
 * both, so a stopped marker still breathes). `phaseOffset` staggers the crew so they never
 * march in lockstep.
 *
 * No `Math.random()` — the phases are baked into the fixture, so the same `t` always yields
 * the same positions (and a screenshot of a given instant is reproducible). With `static:
 * true` the anchors come back untouched in `hold` phase, which is the reduced-motion path
 * the scene takes.
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
      phase: "hold" as const,
    }));
  }
  const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  return PREPARED.map(({ fixture, legs, dwell, total }) => {
    // Walk through the cycle from waypoint 0: hold → leg → hold → leg → …
    let local = (t + fixture.phaseOffset) % total;
    if (local < 0) local += total;
    let position: Vec3 = fixture.waypoints[0]!;
    let phase: CrewPhase = "hold";
    for (let i = 0; i < legs.length; i += 1) {
      const hold = dwell[i]!;
      if (local < hold) {
        position = fixture.waypoints[i]!;
        phase = "hold";
        break;
      }
      local -= hold;
      const leg = legs[i]!;
      if (local < leg.duration) {
        const s = smoothstep(leg.duration > 0 ? local / leg.duration : 1);
        position = [
          leg.from[0] + (leg.to[0] - leg.from[0]) * s,
          leg.from[1] + (leg.to[1] - leg.from[1]) * s,
          leg.from[2] + (leg.to[2] - leg.from[2]) * s,
        ];
        phase = "walk";
        break;
      }
      local -= leg.duration;
    }
    const bob = bobOffset(fixture.bob, t);
    return {
      astronautId: fixture.astronautId,
      x: position[0] + bob[0],
      y: position[1] + bob[1],
      z: position[2] + bob[2],
      module: fixture.module,
      phase,
    };
  });
}
