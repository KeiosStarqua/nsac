// Client seam for the live health feed. One same-origin request against the web proxy
// (`/api/health/live/:astronautId` → backend `/api/health/live/:astronautId`); never throws.
//
// The proxy route owns the backend URL and the 1500 ms timeout, so the browser never learns the
// backend address. Any failure — offline, non-2xx (the endpoint may not be deployed yet), timeout,
// non-JSON or a payload that fails the contract — resolves `null`, and the caller keeps whatever
// it already had.
import { parseLiveHealth, type LiveHealthPayload } from "../model/liveHealth";

export function liveHealthProxyPath(astronautId: string): string {
  return `/api/health/live/${encodeURIComponent(astronautId)}`;
}

export interface FetchLiveHealthOptions {
  readonly signal?: AbortSignal;
  /** Test seam (vitest injects a fake fetch; browser code keeps the global). */
  readonly fetchImpl?: typeof fetch;
}

export async function fetchLiveHealth(
  astronautId: string,
  options: FetchLiveHealthOptions = {},
): Promise<LiveHealthPayload | null> {
  const id = astronautId.trim();
  if (!id) return null;
  const doFetch = options.fetchImpl ?? fetch;
  try {
    const response = await doFetch(liveHealthProxyPath(id), {
      signal: options.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return parseLiveHealth(await response.json());
  } catch {
    return null;
  }
}
