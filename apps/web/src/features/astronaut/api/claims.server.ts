import "@tanstack/react-start/server-only";
import { parseClaimsState, type ClaimEntry } from "../model/claims";
import { publishEvent } from "../../agent/broadcast";

const REQUEST_TIMEOUT_MS = 1500;
const DEFAULT_BACKEND_URL = "http://127.0.0.1:3200";

export type ClaimReason = "taken" | "unavailable" | "error";
export type ClaimResult = { ok: true } | { ok: false; reason: ClaimReason };
export type ClaimsListResult = { claims: ClaimEntry[]; reachable: boolean; epoch: number | null };
export type HeartbeatResult = { reachable: boolean; refreshed: boolean };
export type ReleaseAllResult = {
  reachable: boolean;
  ok: boolean;
  cleared?: number;
  epoch?: number;
};

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
 * as before the lock feature — never blocked by an unreachable demo box. `epoch` is the
 * force-release counter (null when the backend is old or unreachable): the client drops its own
 * pick when the stored epoch differs.
 */
export async function fetchBackendClaims(sessionId?: string): Promise<ClaimsListResult> {
  const base = backendBase();
  if (!base) return { claims: [], reachable: false, epoch: null };
  const url = new URL("/api/claims", base);
  if (sessionId) url.searchParams.set("sessionId", sessionId);

  const res = await fetchWithTimeout(url);
  if (!res?.ok) return { claims: [], reachable: false, epoch: null };
  try {
    const state = parseClaimsState(await res.json());
    return { claims: state.claims, reachable: true, epoch: state.epoch };
  } catch {
    return { claims: [], reachable: false, epoch: null };
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
  if (res.ok) {
    // Shared memory (v1 broadcast): claim thành công → claims.changed, best-effort, nuốt lỗi.
    try {
      await publishEvent({
        topic: "claims.changed",
        astronautId,
        source: "web-claims",
        payload: { astronautId, action: "claimed" },
      });
    } catch {
      // swallow — claim không được fail vì broadcast
    }
    return { ok: true };
  }
  if (res.status === 409) return { ok: false, reason: "taken" };
  return { ok: false, reason: "error" };
}

/**
 * Force-release every claim (`POST /api/claims/reset`, unauthenticated demo endpoint by design:
 * a new anonymous user stuck on a full crew list must be able to free the seats). The backend
 * clears the rows AND bumps the reset epoch, which is what makes open tabs drop their picks.
 * Any failure → `{ reachable: false, ok: false }`; `ok` requires a literal `ok === true`.
 */
export async function postBackendReset(): Promise<ReleaseAllResult> {
  const base = backendBase();
  if (!base) return { reachable: false, ok: false };
  const url = new URL("/api/claims/reset", base);

  const res = await fetchWithTimeout(url, { method: "POST" });
  if (!res?.ok) return { reachable: false, ok: false };
  try {
    const payload = (await res.json()) as { ok?: unknown; cleared?: unknown; epoch?: unknown };
    if (payload?.ok !== true) return { reachable: true, ok: false };
    return {
      reachable: true,
      ok: true,
      cleared: typeof payload.cleared === "number" ? payload.cleared : undefined,
      epoch:
        typeof payload.epoch === "number" && Number.isInteger(payload.epoch) && payload.epoch >= 0
          ? payload.epoch
          : undefined,
    };
  } catch {
    return { reachable: true, ok: false };
  }
}

/**
 * Keep this session's claim alive (`POST /api/claims/heartbeat`). Không broadcast: heartbeat chỉ
 * làm mới TTL, không phải sự kiện cho agent khác. Mọi failure (không backend, timeout, payload
 * lạ) → `reachable: false, refreshed: false`; caller không bao giờ bị chặn vì việc này.
 */
export async function postBackendHeartbeat(sessionId: string): Promise<HeartbeatResult> {
  const base = backendBase();
  if (!base) return { reachable: false, refreshed: false };
  const url = new URL("/api/claims/heartbeat", base);

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!res?.ok) return { reachable: false, refreshed: false };
  try {
    const payload = (await res.json()) as { ok?: unknown; refreshed?: unknown };
    return { reachable: true, refreshed: payload?.ok === true && payload?.refreshed === true };
  } catch {
    return { reachable: false, refreshed: false };
  }
}
