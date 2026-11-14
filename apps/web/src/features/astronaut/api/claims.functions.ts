import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ClaimEntry } from "../model/claims";

const sessionIdSchema = z.string().trim().min(8).max(128);
const claimInputSchema = z.object({
  sessionId: sessionIdSchema,
  astronautId: z.string().trim().min(1),
});

/**
 * Claims list for the HUD picker. Always resolves: when the backend is unavailable the
 * `reachable: false` result lets the picker run exactly as before (local-only pick).
 * Input is lenient — a missing/invalid sessionId is treated as absent, never an error.
 */
export const listClaims = createServerFn({ method: "GET" })
  .validator((data?: { sessionId?: unknown }) => {
    const parsed = sessionIdSchema.safeParse(data?.sessionId);
    return { sessionId: parsed.success ? parsed.data : undefined };
  })
  .handler(async ({ data }): Promise<{ claims: ClaimEntry[]; reachable: boolean }> => {
    const { fetchBackendClaims } = await import("./claims.server");
    return fetchBackendClaims(data.sessionId);
  });

/**
 * Claim an astronaut for this session. Never throws: invalid input or a backend failure
 * collapse to a typed reason (`taken` | `unavailable` | `error`); backend bodies never leak.
 */
export const claimAstronaut = createServerFn({ method: "POST" })
  .validator((data?: { sessionId?: unknown; astronautId?: unknown }) => data ?? {})
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; reason: "taken" | "unavailable" | "error" }> => {
    const parsed = claimInputSchema.safeParse(data);
    if (!parsed.success) return { ok: false, reason: "error" };
    const { postBackendClaim } = await import("./claims.server");
    return postBackendClaim(parsed.data.sessionId, parsed.data.astronautId);
  });
