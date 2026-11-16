import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRequest, backendBase } from "../../admin/api/admin-gate.server";

/**
 * Server functions for the agent core switch (`/admin/core`) — dual-core, HARNESSING §18.
 *
 * Both surfaces are admin-gated (same HMAC `sky_admin` cookie re-check as every other admin
 * function). There is no public reader: the runtime reads the backend setting directly
 * (`features/agent/runtime/agent-core.server.ts`), and the console renders the pi HUD either way.
 *
 * Default is always `pi`: an unset row, a garbage row or an unreachable backend resolves `pi`.
 */

const BACKEND_TIMEOUT_MS = 1500;

export const AGENT_CORES = ["pi", "mastra"] as const;
export type AgentCoreId = (typeof AGENT_CORES)[number];

// Literal enum so the schema type is exactly `AgentCoreId`; a drift between the two fails the check.
export const agentCoreSchema = z.object({
  core: z.enum(["pi", "mastra"]),
});

/** Only `mastra` differs from the default; anything else means `pi`. */
function normalizeCore(value: unknown): AgentCoreId {
  return value === "mastra" ? "mastra" : "pi";
}

function normalizeUpdatedAt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type AgentCoreStateResult =
  | { status: "ok"; core: AgentCoreId; updatedAt: number | null }
  | { status: "unauthorized" }
  | { status: "backend_error" };

/** Admin read for the CoreTab: effective core + when it was last saved. */
export const getAgentCoreFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AgentCoreStateResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/agent-core`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      return {
        status: "ok",
        core: normalizeCore((json as { core?: unknown })?.core),
        updatedAt: normalizeUpdatedAt((json as { updatedAt?: unknown })?.updatedAt),
      };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  },
);

export type SetAgentCoreResult =
  | { status: "ok"; core: AgentCoreId; updatedAt: number | null }
  | { status: "unauthorized" }
  | { status: "invalid_core" }
  | { status: "backend_error" };

/** Admin write: PUT the chosen core. Backend 400 ⇒ `invalid_core`. */
export const setAgentCoreFn = createServerFn({ method: "POST" })
  .validator(agentCoreSchema)
  .handler(async ({ data }): Promise<SetAgentCoreResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/agent-core`, {
        method: "PUT",
        signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ core: data.core }),
      });
      if (res.status === 400) {
        const json: unknown = await res.json().catch(() => null);
        if ((json as { error?: unknown })?.error === "bad_core") return { status: "invalid_core" };
        return { status: "backend_error" };
      }
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      return {
        status: "ok",
        core: normalizeCore((json as { core?: unknown })?.core),
        updatedAt: normalizeUpdatedAt((json as { updatedAt?: unknown })?.updatedAt),
      };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  });
