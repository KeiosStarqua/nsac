import "@tanstack/react-start/server-only";
import { parseClaims, type ClaimEntry } from "../model/claims";

const REQUEST_TIMEOUT_MS = 1500;
const DEFAULT_BACKEND_URL = "http://127.0.0.1:3200";

export type ClaimReason = "taken" | "unavailable" | "error";
export type ClaimResult = { ok: true } | { ok: false; reason: ClaimReason };
export type ClaimsListResult = { claims: ClaimEntry[]; reachable: boolean };

function backendBase(): URL | null {
  const base = process.env.BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
  try {
    return new URL(base);
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: URL, init?: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { accept: "application/json", ...init?.headers },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read the claims from the backend (`GET /api/claims`). Any failure (no backend, timeout,
 * bad payload) returns `reachable: false` with an empty list; the picker then behaves exactly
 * as before the lock feature — never blocked by an unreachable demo box.
 */
export async function fetchBackendClaims(sessionId?: string): Promise<ClaimsListResult> {
  const base = backendBase();
  if (!base) return { claims: [], reachable: false };
  const url = new URL("/api/claims", base);
  if (sessionId) url.searchParams.set("sessionId", sessionId);

  const res = await fetchWithTimeout(url);
  if (!res?.ok) return { claims: [], reachable: false };
  try {
    return { claims: parseClaims(await res.json()), reachable: true };
  } catch {
    return { claims: [], reachable: false };
  }
}

/**
 * Claim an astronaut for this session (`POST /api/claims`). Backend bodies are never leaked;
 * the outcome is reduced to a typed reason. 409 → `taken`; timeout/unreachable/non-JSON →
 * `unavailable` (the caller may proceed with a local pick); any other non-OK → `error`.
 */
export async function postBackendClaim(sessionId: string, astronautId: string): Promise<ClaimResult> {
  const base = backendBase();
  if (!base) return { ok: false, reason: "unavailable" };
  const url = new URL("/api/claims", base);

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, astronautId }),
  });
  if (!res) return { ok: false, reason: "unavailable" };
  if (res.ok) return { ok: true };
  if (res.status === 409) return { ok: false, reason: "taken" };
  return { ok: false, reason: "error" };
}
