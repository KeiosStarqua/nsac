// ElevenLabs Speech Engine — admin surface for the hidden /admin page ("Speech Engine" tab).
// Loopback-only like every other admin route (server.ts binds 127.0.0.1); the web admin layer is
// gated by SKY_ADMIN_KEY. No new auth logic here.
//
// The ElevenLabs API key is read server-side only (env `ELEVENLABS_API_KEY`, else the /admin key
// in app_settings — the same key the TTS uses) and is NEVER logged, NEVER returned in a response.
// Engine ids are public instance handles and are safe to display. Upstream error bodies are
// reduced to a short `message` string (no key, no headers, no account internals beyond what
// ElevenLabs chose to send).
//
// All upstream calls go through the injectable `fetchImpl` (default global fetch) so tests never
// hit the network. `ELEVENLABS_API_BASE` is a const resolved at import time (env override for
// tests / staging).

import { z } from "zod";
import { settingsRepo } from "./db/repositories/settings";
import {
  restartSpeechEngine,
  resolveEngineId,
  speechEngineStatus,
  stopSpeechEngine,
} from "./speechEngine";

/** Base URL of the ElevenLabs API. Resolved once at import; tests may set ELEVENLABS_API_BASE first. */
export const ELEVENLABS_API_BASE = (process.env.ELEVENLABS_API_BASE?.trim().replace(/\/+$/, "") || "https://api.elevenlabs.io");

const MAX_BODY_BYTES = 4096;
const UPSTREAM_TIMEOUT_MS = 15_000;

const DEFAULT_ENGINE_NAME = "sky-nsac-speech-engine";
const DEFAULT_ENGINE_WS_URL = "wss://nasa.taquangkhoi.com/speech/ws";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Read + cap the request body. An empty body parses as `{}`. Returns `undefined` when the body is
 * too large or unparseable — the caller maps that to 413/400.
 */
async function readJsonBody(req: Request): Promise<{ tooLarge: boolean; body: unknown }> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { tooLarge: true, body: undefined };
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { tooLarge: true, body: undefined };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) return { tooLarge: false, body: {} };
  return { tooLarge: false, body: safeJsonParse(text) };
}

/** The API key is read server-side only; returns null when neither source exists. */
function getApiKey(): string | null {
  const envKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (envKey) return envKey;
  return settingsRepo.getElevenLabsKey()?.key ?? null;
}

function apiKeyConfigured(): boolean {
  return getApiKey() !== null;
}

/**
 * Reduces an upstream error body to a short, safe message. Handles both ElevenLabs error shapes
 * (`{ detail: string }` / `{ detail: { message } }` / `{ message }`) and non-JSON bodies.
 * A plain-text (non-HTML) body of ≤ 300 chars is echoed trimmed and single-lined — it carries
 * ElevenLabs's validation message, never our request, and upstream of us there is no key material.
 */
function upstreamMessage(status: number, rawText: string): string {
  const json = safeJsonParse(rawText);
  if (typeof json === "object" && json !== null) {
    const detail = (json as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim().slice(0, 300);
    if (typeof detail === "object" && detail !== null) {
      const msg = (detail as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 300);
    }
    const msg = (json as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 300);
  }
  const text = rawText
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
  if (text && text.length <= 300 && !/<[^>]*>/.test(text)) {
    return `ElevenLabs responded ${status}: ${text}`;
  }
  return `ElevenLabs responded ${status} (non-JSON body)`;
}

async function upstreamFetch(fetchImpl: typeof fetch, path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetchImpl(`${ELEVENLABS_API_BASE}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Maps a failed upstream call to a safe `{ ok: false, httpStatus, message }` envelope. */
async function upstreamErrorResponse(res: Response): Promise<Response> {
  const raw = await res.text().catch(() => "");
  // Chỉ log status code — không log body (có thể chứa chi tiết tài khoản), không log key.
  console.error(`[speech-admin] upstream status ${res.status}`);
  return Response.json({ ok: false, httpStatus: res.status, message: upstreamMessage(res.status, raw) });
}

const NO_KEY_MESSAGE = "No ElevenLabs API key configured (env ELEVENLABS_API_KEY or the /admin key).";

function unreachableResponse(err: unknown): Response {
  const name = (err as { name?: string } | null)?.name;
  const reason = name === "AbortError" ? "timeout" : "network error";
  return Response.json({ ok: false, httpStatus: 0, message: `ElevenLabs unreachable (${reason}).` });
}

// ---------------------------------------------------------------------------
// GET /api/settings/speech-engine — local state only, never calls ElevenLabs.
// ---------------------------------------------------------------------------

function handleStatus(): Response {
  const status = speechEngineStatus();
  const envId = process.env.ELEVENLABS_SPEECH_ENGINE_ID?.trim() || null;
  const dbId = settingsRepo.getSpeechEngineId()?.engineId ?? null;
  const envOverridesDb = Boolean(envId && dbId);
  const configured = Boolean(status.engineId) && status.wsRunning;
  return Response.json({
    ok: true,
    configured,
    engineId: status.engineId,
    source: status.engineSource,
    wsRunning: status.wsRunning,
    port: status.port,
    lastError: status.lastError,
    apiKeyConfigured: apiKeyConfigured(),
    envOverridesDb,
  });
}

// ---------------------------------------------------------------------------
// POST /api/settings/speech-engine/probe — is the key accepted by ElevenLabs?
// ---------------------------------------------------------------------------

async function handleProbe(req: Request, fetchImpl: typeof fetch): Promise<Response> {
  const { tooLarge, body } = await readJsonBody(req);
  if (tooLarge) return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  if (body === undefined) return Response.json({ ok: false, error: "bad_body" }, { status: 400 });

  const key = getApiKey();
  if (!key) return Response.json({ ok: false, httpStatus: 0, message: NO_KEY_MESSAGE });

  let res: Response;
  try {
    res = await upstreamFetch(fetchImpl, "/v1/speech-engine?page_size=1", {
      method: "GET",
      headers: { "xi-api-key": key, accept: "application/json" },
    });
  } catch (err) {
    return unreachableResponse(err);
  }
  if (res.ok) return Response.json({ ok: true, httpStatus: res.status });
  return upstreamErrorResponse(res);
}

// ---------------------------------------------------------------------------
// POST /api/settings/speech-engine/create — create an engine on the ElevenLabs account.
// ---------------------------------------------------------------------------

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  wsUrl: z.string().trim().min(1).max(2048).optional(),
});

function readEngineIdFromResponse(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null;
  const candidates = [
    (json as { speech_engine_id?: unknown }).speech_engine_id,
    (json as { speechEngineId?: unknown }).speechEngineId,
    (json as { id?: unknown }).id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

async function handleCreate(req: Request, fetchImpl: typeof fetch): Promise<Response> {
  const { tooLarge, body } = await readJsonBody(req);
  if (tooLarge) return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  if (body === undefined) return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "bad_body" }, { status: 400 });

  const name = parsed.data.name?.trim() || DEFAULT_ENGINE_NAME;
  const wsUrl = parsed.data.wsUrl?.trim() || DEFAULT_ENGINE_WS_URL;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(wsUrl);
  } catch {
    return Response.json({ ok: false, error: "bad_ws_url" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "wss:") {
    return Response.json({ ok: false, error: "bad_ws_url" }, { status: 400 });
  }

  const key = getApiKey();
  if (!key) return Response.json({ ok: false, httpStatus: 0, message: NO_KEY_MESSAGE });

  let res: Response;
  try {
    res = await upstreamFetch(fetchImpl, "/v1/speech-engine", {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ name, speech_engine: { ws_url: wsUrl }, auth: { enable_auth: true } }),
    });
  } catch (err) {
    return unreachableResponse(err);
  }
  if (!res.ok) return upstreamErrorResponse(res);

  const json = safeJsonParse(await res.text().catch(() => ""));
  const engineId = readEngineIdFromResponse(json);
  if (!engineId) {
    console.error("[speech-admin] engine created but id unreadable in the upstream response");
    return Response.json({ ok: false, message: "created but engine id unreadable — manage it on the ElevenLabs dashboard" });
  }

  settingsRepo.setSpeechEngineId(engineId);
  const wsRunning = restartSpeechEngine();
  const envShadowing = Boolean(process.env.ELEVENLABS_SPEECH_ENGINE_ID?.trim());
  return Response.json({
    ok: true,
    engineId,
    wsUrl,
    wsRunning,
    ...(envShadowing ? { envShadowing: true } : {}),
  });
}

// ---------------------------------------------------------------------------
// POST /api/settings/speech-engine/stop · /start — local websocket lifecycle.
// ---------------------------------------------------------------------------

function handleStop(): Response {
  stopSpeechEngine();
  return Response.json({ ok: true, wsRunning: false });
}

function handleStart(): Response {
  const wsRunning = restartSpeechEngine();
  return Response.json({ ok: true, wsRunning });
}

// ---------------------------------------------------------------------------
// POST /api/settings/speech-engine/delete — delete the engine on the ElevenLabs account.
// ---------------------------------------------------------------------------

const deleteBodySchema = z.object({
  id: z.string().trim().min(1).max(256).optional(),
});

async function handleDelete(req: Request, fetchImpl: typeof fetch): Promise<Response> {
  const { tooLarge, body } = await readJsonBody(req);
  if (tooLarge) return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  if (body === undefined) return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "bad_body" }, { status: 400 });

  const effective = resolveEngineId();
  const source = effective?.source ?? null;
  const target = parsed.data.id ?? effective?.engineId ?? null;
  if (!target) {
    return Response.json({ ok: false, error: "no_engine" }, { status: 400 });
  }

  const key = getApiKey();
  if (!key) return Response.json({ ok: false, httpStatus: 0, message: NO_KEY_MESSAGE });

  let res: Response;
  try {
    res = await upstreamFetch(fetchImpl, `/v1/speech-engine/${encodeURIComponent(target)}`, {
      method: "DELETE",
      headers: { "xi-api-key": key, accept: "application/json" },
    });
  } catch (err) {
    return unreachableResponse(err);
  }
  if (!res.ok) return upstreamErrorResponse(res);

  // The WS doesn't depend on the id, so no restart here. Clear the stored DB id only when it
  // is the one that was deleted — an env-provided id is left to the host operator.
  if (settingsRepo.getSpeechEngineId()?.engineId === target) {
    settingsRepo.clearSpeechEngineId();
  }
  const note =
    source === "env"
      ? "env ELEVENLABS_SPEECH_ENGINE_ID still set — remove it on the host to stop the browser from connecting"
      : undefined;
  return Response.json({ ok: true, deleted: target, ...(note ? { note } : {}) });
}

/**
 * Xử lý `/api/settings/speech-engine*`. Trả về `null` khi path/method không thuộc module để
 * server.ts fall-through. Lỗi luôn JSON. `fetchImpl` là test seam (mặc định global fetch).
 */
export async function handleSpeechAdminRequest(req: Request, fetchImpl: typeof fetch = fetch): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/api/settings/speech-engine") {
    if (req.method !== "GET") return null;
    return handleStatus();
  }
  if (path === "/api/settings/speech-engine/probe") {
    if (req.method !== "POST") return null;
    return handleProbe(req, fetchImpl);
  }
  if (path === "/api/settings/speech-engine/create") {
    if (req.method !== "POST") return null;
    return handleCreate(req, fetchImpl);
  }
  if (path === "/api/settings/speech-engine/stop") {
    if (req.method !== "POST") return null;
    return handleStop();
  }
  if (path === "/api/settings/speech-engine/start") {
    if (req.method !== "POST") return null;
    return handleStart();
  }
  if (path === "/api/settings/speech-engine/delete") {
    if (req.method !== "POST") return null;
    return handleDelete(req, fetchImpl);
  }
  return null;
}
