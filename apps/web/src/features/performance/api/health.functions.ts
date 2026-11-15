import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_ASTRONAUT_ID } from "../../astronaut/model/astronauts";
import type { PerformanceSnapshot } from "../model/metrics";

const astronautIdSchema = z.string().trim().min(1).max(64);

/**
 * Perf snapshot for `/performance`. Lenient input (a missing or invalid id falls back to the
 * default crew member) and a never-throwing handler: the backend being down is a normal state
 * that renders the fixture fallback.
 */
export const getPerformance = createServerFn({ method: "GET" })
  .validator((data?: { astronautId?: unknown }) => {
    const parsed = astronautIdSchema.safeParse(data?.astronautId);
    return { astronautId: parsed.success ? parsed.data : DEFAULT_ASTRONAUT_ID };
  })
  .handler(async ({ data }): Promise<PerformanceSnapshot> => {
    const { fetchBackendPerformance } = await import("./healthServer.server");
    return fetchBackendPerformance(data.astronautId);
  });
