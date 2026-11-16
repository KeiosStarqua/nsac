import "@tanstack/react-start/server-only";
import { backendBase } from "./agent-model.server";

/**
 * Which agent core runs Sky (dual-core, HARNESSING §18).
 *
 * Resolution: backend `app_settings.agent.core` (`GET /api/settings/agent-core`) → `"pi"`.
 * Unset, garbage or any failure (backend down, timeout, bad payload) resolves `"pi"` — the pi SDK
 * stays the default implementation and a Mastra switch can never happen by accident. The switch is
 * orthogonal to provider/model resolution (`agent-model.server.ts`), which both cores share.
 *
 * Cache mirrors `agent-model.server.ts`: a long-ish TTL on success so a burst of turns does not hit
 * the backend, a short TTL on failure so the next turn retries instead of pinning the fallback.
 */

export type AgentCore = "pi" | "mastra";
export type AgentCoreSource = "backend" | "default";

const BACKEND_TIMEOUT_MS = 1500;
const CACHE_TTL_MS = 15000;
const FAIL_CACHE_TTL_MS = 500;

export function isAgentCore(value: unknown): value is AgentCore {
  return value === "pi" || value === "mastra";
}

let cached: { core: AgentCore; source: AgentCoreSource; at: number; ttl: number } | null = null;

async function fetchCore(): Promise<{ core: AgentCore; source: AgentCoreSource }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${backendBase()}/api/settings/agent-core`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { core: "pi", source: "default" };
    const json: unknown = await res.json();
    const raw = (json as { core?: unknown } | null)?.core;
    // Only an explicit `mastra` opts in; `pi`, garbage and a missing field all mean pi.
    return raw === "mastra" ? { core: "mastra", source: "backend" } : { core: "pi", source: "default" };
  } catch {
    return { core: "pi", source: "default" };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCore(): Promise<{ core: AgentCore; source: AgentCoreSource }> {
  const now = Date.now();
  if (cached && now - cached.at < cached.ttl) return { core: cached.core, source: cached.source };
  const resolved = await fetchCore();
  cached = {
    ...resolved,
    at: now,
    ttl: resolved.source === "backend" ? CACHE_TTL_MS : FAIL_CACHE_TTL_MS,
  };
  return resolved;
}

/** Effective core. Never throws; `"pi"` on any doubt. */
export async function currentAgentCore(): Promise<AgentCore> {
  return (await resolveCore()).core;
}

/** Same value with its source — `/health` shows `agent.core` (backend | default). */
export async function currentAgentCoreInfo(): Promise<{ core: AgentCore; source: AgentCoreSource }> {
  return resolveCore();
}

/** Test-only: drop the process cache. */
export function resetAgentCoreCacheForTests(): void {
  cached = null;
}
