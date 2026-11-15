import "@tanstack/react-start/server-only";
import {
  parsePerformancePayload,
  unavailableSnapshot,
  type PerformanceSnapshot,
} from "../model/metrics";

const REQUEST_TIMEOUT_MS = 1500;
const DEFAULT_BACKEND_URL = "http://127.0.0.1:3200";

function backendBase(): URL | null {
  const base = process.env.BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
  try {
    return new URL(base);
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: URL): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read `GET /api/health/performance/:astronautId` from the simulated backend.
 *
 * Any failure — unreachable, 404 (the endpoint may not be deployed yet), timeout, non-JSON or a
 * payload that fails the contract — resolves to `metrics: null`, never throws. `/performance`
 * then renders its fixture fallback with the "backend unavailable" footnote, so the demo stage
 * cannot break while the backend deploy lags this web branch.
 */
export async function fetchBackendPerformance(astronautId: string): Promise<PerformanceSnapshot> {
  const base = backendBase();
  if (!base) return unavailableSnapshot(astronautId);

  const url = new URL(`/api/health/performance/${encodeURIComponent(astronautId)}`, base);
  const response = await fetchWithTimeout(url);
  if (!response?.ok) return unavailableSnapshot(astronautId);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return unavailableSnapshot(astronautId);
  }

  const parsed = parsePerformancePayload(body);
  if (!parsed) return unavailableSnapshot(astronautId);

  return {
    astronautId,
    asOf: parsed.asOf || null,
    metrics: parsed.metrics,
    derived: parsed.derived,
    reachable: true,
  };
}
