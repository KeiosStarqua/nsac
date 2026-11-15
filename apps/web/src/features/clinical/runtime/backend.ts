import "@tanstack/react-start/server-only";
import {
  openFindings,
  parseFindingResponse,
  parseFindingsResponse,
  type ClinicalFinding,
} from "../model/findings";

// HTTP loopback to the backend's `/api/clinical/*` routes. Same documented style as
// broadcast/runtime/backend.ts: never throws, one test seam (`setClinicalFetch`), fixed timeout.
const REQUEST_TIMEOUT_MS = 1500;
const REVIEW_TIMEOUT_MS = 2000;
const DEFAULT_BACKEND_URL = "http://127.0.0.1:3200";

export type ClinicalFetch = typeof fetch;

let clinicalFetchOverride: ClinicalFetch | null = null;
/** Test hook (mirror setBackendFetch): inject fake fetch; null restores global fetch. */
export function setClinicalFetch(fn: ClinicalFetch | null) {
  clinicalFetchOverride = fn;
}

function backendBase(): URL | null {
  const base = process.env.BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
  try {
    return new URL(base);
  } catch {
    return null;
  }
}

function fetchWithTimeout(url: URL, init: RequestInit | undefined, timeoutMs: number): Promise<Response | null> {
  const doFetch = clinicalFetchOverride ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return doFetch(url, {
    ...init,
    signal: controller.signal,
    headers: { accept: "application/json", ...init?.headers },
  })
    .catch(() => null)
    .finally(() => clearTimeout(timer));
}

/**
 * Read findings for an astronaut. `null` on ANY failure (unreachable, non-2xx, bad envelope,
 * timeout) — callers treat it as "backend unavailable", never throw.
 */
export async function fetchClinicalFindings(options: {
  astronautId: string;
  /** Backend status filter: new|reviewed|resolved|all (default all). */
  status?: "new" | "reviewed" | "resolved" | "all";
  /** Fetch cap (backend clamps to ≤100). */
  limit?: number;
  /** Drop resolved findings and cap the result (default true for the panel). */
  openOnly?: boolean;
  timeoutMs?: number;
}): Promise<ClinicalFinding[] | null> {
  const base = backendBase();
  if (!base) return null;
  const url = new URL("/api/clinical/findings", base);
  url.searchParams.set("astronautId", options.astronautId);
  url.searchParams.set("status", options.status ?? "all");
  url.searchParams.set("limit", String(Math.min(100, Math.max(1, Math.trunc(options.limit ?? 50)))));

  const res = await fetchWithTimeout(url, undefined, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  if (!res?.ok) return null;
  try {
    const body = await res.json();
    const findings = parseFindingsResponse(body);
    if (findings === null) return null;
    return options.openOnly === false ? findings : openFindings(findings, 20);
  } catch {
    return null;
  }
}

export type ClinicalReviewOutcome =
  | { readonly ok: true; readonly finding: ClinicalFinding }
  | { readonly ok: false; readonly error: "not_found" | "bad_request" | "unavailable" };

/** Map a review-endpoint HTTP status: "ok" (parse the body), or a typed failure. */
export function reviewHttpStatus(status: number): "ok" | "not_found" | "bad_request" | "unavailable" {
  if (status === 404) return "not_found";
  if (status === 400) return "bad_request";
  if (status >= 200 && status < 300) return "ok";
  return "unavailable";
}

/**
 * POST /api/clinical/findings/:id/review — mark a finding reviewed or resolved.
 * 2 s timeout; 404/400 map to typed errors; everything else is "unavailable". Never throws.
 */
export async function postClinicalReview(options: {
  id: string;
  action: "reviewed" | "resolved";
  note?: string;
}): Promise<ClinicalReviewOutcome> {
  const base = backendBase();
  if (!base) return { ok: false, error: "unavailable" };
  const id = options.id.trim();
  if (!id || id.length > 64) return { ok: false, error: "bad_request" };
  const url = new URL(`/api/clinical/findings/${encodeURIComponent(id)}/review`, base);

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: options.action, ...(options.note ? { note: options.note.slice(0, 600) } : {}) }),
    },
    REVIEW_TIMEOUT_MS,
  );
  if (!res) return { ok: false, error: "unavailable" };
  const mapped = reviewHttpStatus(res.status);
  if (mapped !== "ok") return { ok: false, error: mapped };
  try {
    const body = await res.json();
    const finding = parseFindingResponse(body);
    if (!finding) return { ok: false, error: "unavailable" };
    return { ok: true, finding };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
