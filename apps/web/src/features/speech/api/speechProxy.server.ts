import "@tanstack/react-start/server-only";
import { z } from "zod";

// Loopback proxies to the Bun backend (`apps/backend`) for the ElevenLabs Speech Engine voice
// chat on `/`. The browser never sees the backend URL and never gets the API key — the engine id
// handed out by `/api/speech/config` is a public instance handle, the conversation token is minted
// server-side by `/api/speech/token`, and everything else happens inside the backend. Mirrors the
// spirit of `routes/api/tts.ts` (cross-site guard) but answers inside a feature module so vitest
// covers the branches.
const SAME_SITE = new Set(["same-origin", "same-site", "none"]);
// The backend answers register/config from memory — nothing upstream is contacted on these paths.
// 1500 ms is generous; anything slower is a broken backend, not a slow one.
const BACKEND_TIMEOUT_MS = 1500;
// `/api/speech/token` makes the backend call ElevenLabs (conversation token mint), so it gets a
// longer budget than the in-memory routes; still short enough to fail quietly on the console.
const TOKEN_TIMEOUT_MS = 5000;

export const SpeechRegisterBody = z.object({
  astronautId: z.string().min(1).max(64),
});

// `/api/chat-stream` accepts one optional flag — the spoken-mode system-prompt suffix. Anything
// else fails safeParse → 400, same as before the flag existed.
export const chatStreamBodySchema = z.object({
  astronautId: z.string().min(1).max(64),
  message: z.string().min(1).max(500),
  mode: z.enum(["voice"]).optional(),
});

function backendBase(): string {
  return (process.env.BACKEND_URL?.trim() || "http://127.0.0.1:3200").replace(/\/+$/, "");
}

/** True when a cross-site browser called us (the same guard `routes/api/tts.ts` uses). */
export function isCrossSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return !!site && !SAME_SITE.has(site);
}

const forbidden = () =>
  new Response("forbidden", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * POST semantics: zod-validated `{ astronautId }`, forwarded to the backend's `/api/speech/register`
 * so the browser's astronaut pick becomes the conversation binding. The backend stores it in an
 * in-memory slot (10 min TTL); `init { conversation_id }` consumes the freshest slot.
 */
export async function handleSpeechRegister(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (isCrossSite(request)) return forbidden();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const parsed = SpeechRegisterBody.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${backendBase()}/api/speech/register`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      return Response.json({ ok: false, error: "speech_backend" }, { status: 502 });
    }
    // Backend's `{ ok: true }` passes through; any other payload is treated as a broken backend.
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return Response.json({ ok: false, error: "speech_backend" }, { status: 502 });
    }
    if ((data as { ok?: unknown } | null)?.ok === true) {
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: "speech_backend" }, { status: 502 });
  } catch {
    return Response.json({ ok: false, error: "speech_backend" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET semantics: `{ engineId }` from the backend (env `ELEVENLABS_SPEECH_ENGINE_ID`). When the
 * backend has no engine configured it answers `404 { ok: false, error: "no_engine" }` — passed
 * through unchanged so the client can show the quiet "Voice not configured" hint. Everything
 * else maps to 502 `speech_backend`.
 */
export async function handleSpeechConfig(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (isCrossSite(request)) return forbidden();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${backendBase()}/api/speech/config`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    if (res.ok && typeof (data as { engineId?: unknown } | null)?.engineId === "string") {
      return Response.json({ engineId: (data as { engineId: string }).engineId });
    }
    if (res.status === 404 && (data as { error?: unknown } | null)?.error === "no_engine") {
      return Response.json({ ok: false, error: "no_engine" }, { status: 404 });
    }
    return Response.json({ ok: false, error: "speech_backend" }, { status: 502 });
  } catch {
    return Response.json({ ok: false, error: "speech_backend" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST semantics: mints an ElevenLabs conversation token through the backend
 * (`POST /api/speech/token` — the backend holds the API key). The engine is created with
 * `auth.enable_auth: true`, so the browser must present a token instead of a bare agent id.
 * `200 { token }` passes through; the backend's `404 no_engine` passes through unchanged so the
 * client can show the quiet "Voice not configured" hint; everything else is a 502. The token is
 * never logged.
 */
export async function handleSpeechToken(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (isCrossSite(request)) return forbidden();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${backendBase()}/api/speech/token`, {
      method: "POST",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    const token = (data as { token?: unknown } | null)?.token;
    if (res.ok && typeof token === "string" && token.length > 0) {
      return Response.json({ token });
    }
    if (res.status === 404 && (data as { error?: unknown } | null)?.error === "no_engine") {
      return Response.json({ ok: false, error: "no_engine" }, { status: 404 });
    }
    return Response.json({ ok: false, error: "speech_backend" }, { status: 502 });
  } catch {
    return Response.json({ ok: false, error: "speech_backend" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
