import { createServerFn } from "@tanstack/react-start";
import { scenarioInputSchema, timelineInputSchema } from "~/shared/scenario/search";
import { briefing } from "./agent.server";
import { buildTimeline } from "./timeline.server";

/** Whole story up to `horizon`. The handler body is stripped from the client bundle. */
export const getTimeline = createServerFn({ method: "GET" })
  .validator(timelineInputSchema)
  .handler(async ({ data }) => buildTimeline(data));

/** Built-in briefing as an OpenUI Lang program. Used for deferred (streamed) SSR on the dashboard. */
export const getBriefing = createServerFn({ method: "GET" })
  .validator(scenarioInputSchema)
  .handler(async ({ data }) => briefing({ seed: data.seed, day: data.day, interventions: data.iv }));
