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
 * `epoch` is the force-release counter (`null` for an old backend or when unreachable).
 */
export const listClaims = createServerFn({ method: "GET" })
  .validator((data?: { sessionId?: unknown }) => {
    const parsed = sessionIdSchema.safeParse(data?.sessionId);
    return { sessionId: parsed.success ? parsed.data : undefined };
  })
  .handler(async ({ data }): Promise<{ claims: ClaimEntry[]; reachable: boolean; epoch: number | null }> => {
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

/**
 * Force-release every claim in one shot (picker's "force release" button). Unauthenticated by
 * design — the demo contract: a new anonymous user stuck on a full crew list must be able to free
 * the seats. The backend bumps its reset epoch, so open tabs drop their own picks on the next poll
 * (or on mount), which is what makes the release real for *everyone*, not just the DB rows.
 * Never throws: any backend failure collapses to `{ reachable: false, ok: false }`.
 */
export const releaseAllClaims = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: boolean; reachable: boolean; cleared?: number; epoch?: number }> => {
    const { postBackendReset } = await import("./claims.server");
    const res = await postBackendReset();
    if (res.ok) {
      // Shared memory (v1 broadcast): cả phi hành đoàn vừa được gỡ → claims.changed, best-effort.
      // Payload phải khớp schema strict `claims.changed` (astronautId bắt buộc), nên dùng "*"
      // nghĩa là "mọi crew", không phải một id cụ thể.
      try {
        const { publishEvent } = await import("../../agent/broadcast");
        await publishEvent({
          topic: "claims.changed",
          source: "web-claims",
          payload: { astronautId: "*", action: "reset" },
        });
      } catch {
        // swallow — release không được fail vì broadcast
      }
    }
    return res;
  },
);

/**
 * Làm mới claim của session (heartbeat mỗi 30 s khi tab visible — xem `useClaimHeartbeat`).
 * Không bao giờ throw và không bao giờ tạo claim: input sai hoặc backend lỗi → cả hai false.
 */
export const heartbeatClaim = createServerFn({ method: "POST" })
  .validator((data?: { sessionId?: unknown }) => {
    const parsed = sessionIdSchema.safeParse(data?.sessionId);
    return { sessionId: parsed.success ? parsed.data : undefined };
  })
  .handler(async ({ data }): Promise<{ reachable: boolean; refreshed: boolean }> => {
    if (!data.sessionId) return { reachable: false, refreshed: false };
    const { postBackendHeartbeat } = await import("./claims.server");
    return postBackendHeartbeat(data.sessionId);
  });
