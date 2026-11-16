import { definePlugin } from "nitro";
import { ensureSkyMastraRoot } from "~/features/agent/mastra/mastra-observability.server";
import { scrubScheduledFireError, seedDefaultSkySchedules } from "~/features/agent/mastra/mastra-schedules.server";

/**
 * Boot wiring for the Mastra Schedules runtime (HARNESSING §19, 2026-11-17). Runs once when
 * the Nitro app boots (async plugins are awaited before requests are served). Best effort end
 * to end and never crashes boot: any failure is caught and logged, and the server comes up
 * exactly as before — without schedules.
 *
 * `SKY_SCHEDULES_DISABLED=1` short-circuits before touching the root: no root build, no
 * workers, no seed.
 *
 * Note on `startWorkers()`: Mastra 1.83.0's named form filters BY WORKER NAME and throws when
 * nothing matches — no worker named "sky-nsac" exists (registered workers are `scheduler`,
 * `agent-schedule`, and the default `orchestration`). The no-argument form starts every
 * registered worker; with `scheduler: { enabled: true }` on the root ctor it deterministically
 * registers and starts the scheduler + agent-schedule workers at boot.
 */
export default definePlugin(async () => {
  if (process.env.SKY_SCHEDULES_DISABLED === "1") {
    console.log("[sky-schedules] disabled (SKY_SCHEDULES_DISABLED=1)");
    return;
  }
  try {
    const root = await ensureSkyMastraRoot();
    if (!root || typeof root.startWorkers !== "function") {
      console.warn("[sky-schedules] workers not started (root unavailable)");
      return;
    }
    await root.startWorkers();
    console.log("[sky-schedules] workers started");
    try {
      await seedDefaultSkySchedules(root);
    } catch (error) {
      console.warn("[sky-schedules] seed skipped:", scrubScheduledFireError(error));
    }
  } catch (error) {
    console.warn("[sky-schedules] workers not started:", scrubScheduledFireError(error));
  }
});
