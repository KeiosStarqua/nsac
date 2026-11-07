// Server-only: imported only from scenario.functions.ts handlers. The marker import makes the build
// fail loudly if this file ever ends up in the client bundle.
import "@tanstack/react-start/server-only";
import { trajectory, type ScenarioParams, type Snapshot } from "../model/readiness";

/**
 * Illustrative scenario from the project's demo script (README "Demo (60 giây)").
 * This is the seam where a real adapter (the Python backend's simulation API) plugs in later;
 * the rest of the web app only sees `ScenarioParams` and `Snapshot`.
 */
export const SCENARIO: ScenarioParams = {
  startDay: 170,
  endDay: 184,
  startScore: 62,
  endScore: 81,
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Yields one day at a time. `paceMs` stands in for simulated time passing. */
export async function* streamTrajectory(paceMs: number): AsyncGenerator<Snapshot> {
  for (const snapshot of trajectory(SCENARIO)) {
    yield snapshot;
    if (paceMs > 0) await sleep(paceMs);
  }
}
