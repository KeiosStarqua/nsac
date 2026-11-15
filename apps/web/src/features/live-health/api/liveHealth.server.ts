import "@tanstack/react-start/server-only";
import { parseLiveHealth, type LiveHealthPayload } from "../model/liveHealth";

// Loopback read of the backend's live health feed, same documented style as the other proxies:
// one fixed timeout, one test seam (`setLiveHealthFetch`), never throws.
const REQUEST_TIMEOUT_MS = 1500;
const DEFAULT_BACKEND_URL = "http://127.0.0.1:3200";

export type LiveHealthFetch = typeof fetch;

let fetchOverride: LiveHealthFetch | null = null;
/** Test hook: inject fake fetch; null restores the global. */
export function setLiveHealthFetch(fn: LiveHealthFetch | null) {
  fetchOverride = fn;
}

function backendBase(): URL | null {
  const base = process.env.BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
  try {
    return new URL(base);
  } catch {
    return null;
  }
}

export type LiveHealthBackendResult =
  | { readonly status: "ok"; readonly payload: LiveHealthPayload }
  | { readonly status: "unavailable" }
  | { readonly status: "timeout" };

/**
 * Read `GET /api/health/live/:astronautId` from the simulated backend.
 *
 * `unavailable` covers every failure that is not a timeout — unreachable, 404 (the route may not
 * be deployed yet), non-JSON, or a body that fails the contract. The web proxy answers 5xx and the
 * client keeps its last good payload, so a lagging backend deploy can never break `/performance`.
 */
export async function fetchBackendLiveHealth(
  astronautId: string,
  options: { timeoutMs?: number } = {},
): Promise<LiveHealthBackendResult> {
  const base = backendBase();
  if (!base) return { status: "unavailable" };

  const url = new URL(`/api/health/live/${encodeURIComponent(astronautId)}`, base);
  const doFetch = fetchOverride ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const response = await doFetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { status: "unavailable" };
    const payload = parseLiveHealth(await response.json());
    if (!payload) return { status: "unavailable" };
    return { status: "ok", payload };
  } catch {
    return controller.signal.aborted ? { status: "timeout" } : { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
