import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { snapshotFor, type ScenarioParams, type Snapshot } from "../model/readiness";
import { SCENARIO, streamTrajectory } from "./scenario.server";

/** Awaited by the /demo loader: the page cannot render the gauge without it. */
export const getScenario = createServerFn({ method: "GET" }).handler(
  async (): Promise<ScenarioParams> => SCENARIO,
);

/** Deferred by the / loader: streamed into the landing page after the first HTML. */
export const getAlertSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<Snapshot> => snapshotFor("alert", SCENARIO),
);

const FastForwardInput = z.object({
  // Bounded at the trust boundary so a client cannot hold a connection open for long.
  paceMs: z.number().int().min(0).max(1000).default(120),
});

/** Streams one typed `Snapshot` per simulated day, from the alert day to the end of the scenario. */
export const streamFastForward = createServerFn({ method: "POST" })
  .validator(FastForwardInput)
  .handler(async function* ({ data }) {
    yield* streamTrajectory(data.paceMs);
  });
