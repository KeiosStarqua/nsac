// ElevenLabs Speech Engine — hands-free voice conversation for the `/` console.
// The browser starts an ElevenLabs conversation (`@elevenlabs/client`, agentId = the speech engine
// id, see apps/web); ElevenLabs connects BACK to this server over a WebSocket on its own loopback
// port (`SPEECH_WS_PORT`, default 3300) and streams transcripts. This module is the upstream the
// engine talks to: verify the engine's JWT on upgrade, map the conversation to the astronaut who
// picked up the HUD, and answer each user turn with the SAME agent brain as the text chat (the web
// `/api/chat-stream` SSE pipeline, mode "voice").
//
// Hand-rolled on `Bun.serve({ websocket })` implementing the documented wire protocol:
//   in   init { conversation_id } · user_transcript { user_transcript[], event_id? } · ping · close · error
//   out  agent_response { content, event_id?, is_final } · pong
// https://elevenlabs.io/docs/eleven-api/resources/libraries/speech-engine/javascript-sdk-reference ("Wire protocol")
// The `@elevenlabs/elevenlabs-js` `SpeechEngine.Server` was tried first and does NOT work under
// Bun: `node:http`'s server accepts the TCP connection but never answers (see repo docs), so every
// handshake/WS upgrade hangs. JWT verification is replicated exactly (HS256, secret = SHA-256 of
// the residency-suffix-stripped API key) and stays ON always — there is no `disableAuth` here.
//
// Phase 1 scope: accumulate the reply and `session.sendResponse` it whole on `done` — no streaming.
// The `ui` SSE frame (generative UI → HUD swap) is dropped with a log line.
//
// Wiring: `startSpeechEngine()` is called once from `server.ts` (same process); the admin surface
// (`speechAdmin.ts`) can stop/start/restart it and reads `speechEngineStatus()`. The HTTP surface
// (`/api/speech/register`, `/api/speech/config`, `/api/speech/token`) delegates through
// `handleSpeechRequest`.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { settingsRepo } from "./db/repositories/settings";
import { astronautsRepo } from "./db/repositories/astronauts";

const DEFAULT_SPEECH_PORT = 3300;
/** Fallback when no astronaut ever picked the HUD (matches the web default crew). */
export const DEFAULT_ASTRONAUT = "ayla-reyes";
/** Registration lifetime: a pick older than this no longer binds a new conversation. */
export const REGISTRATION_TTL_MS = 10 * 60 * 1000;
/** POST to the web SSE pipeline on loopback; override with SKY_WEB_CHAT_URL when web runs elsewhere. */
const DEFAULT_CHAT_URL = "http://127.0.0.1:3100/api/chat-stream";
const MAX_REGISTRATIONS = 512;
const MAX_BINDINGS = 512;

// ---------------------------------------------------------------------------
// JWT verification — exact replication of the SDK's `verifySpeechEngineJwt`
// (HS256, secret = SHA-256 of the residency-suffix-stripped API key).
// ---------------------------------------------------------------------------

const ISSUER = "https://api.elevenlabs.io/convai/speech-engine";
const SUBJECT = "convai_speech_engine_upstream";
const LEEWAY_SECONDS = 60;
const RESIDENCY_KEY_SUFFIX = /_residency_[a-z0-9]+$/;

function normalizeApiKeyForSigning(apiKey: string): string {
  return apiKey.trim().replace(RESIDENCY_KEY_SUFFIX, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

export interface SpeechEngineJwtPayload {
  iss: string;
  sub: string;
  exp: number;
  iat: number;
}

/**
 * Verifies the `X-Elevenlabs-Speech-Engine-Authorization` JWT. Returns the decoded payload on
 * success; throws `Error` with a reason that never includes key material or token contents on
 * failure. Callers must reject the connection when this throws.
 */
export function verifySpeechEngineJwt(value: string, apiKey: string): SpeechEngineJwtPayload {
  let token = value.trim();
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT: expected 3 parts");
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8"));
  } catch {
    throw new Error("Invalid JWT: failed to decode payload");
  }
  const secret = createHash("sha256").update(normalizeApiKeyForSigning(apiKey), "utf-8").digest();
  const expectedSignature = createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest();
  const actualSignature = base64UrlDecode(signatureB64);
  if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
    throw new Error(
      "Invalid JWT: signature mismatch — make sure the API key used by your Speech Engine server matches the one used to create the engine.",
    );
  }
  const p = payload as Record<string, unknown>;
  if (p.iss !== ISSUER) {
    throw new Error(`Invalid JWT: expected issuer "${ISSUER}", got "${String(p.iss)}"`);
  }
  if (p.sub !== SUBJECT) {
    throw new Error(`Invalid JWT: expected subject "${SUBJECT}", got "${String(p.sub)}"`);
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof p.exp !== "number") {
    throw new Error("Invalid JWT: missing exp claim");
  }
  if (typeof p.iat !== "number") {
    throw new Error("Invalid JWT: missing iat claim");
  }
  if (p.exp + LEEWAY_SECONDS < now) {
    throw new Error("Invalid JWT: token has expired");
  }
  if (p.iat - LEEWAY_SECONDS > now) {
    throw new Error("Invalid JWT: iat is in the future");
  }
  return p as unknown as SpeechEngineJwtPayload;
}

// ---------------------------------------------------------------------------
// Registration ↔ conversation binding (in-memory, process-local by design).
// The browser POSTs `/api/speech/register` right before starting the ElevenLabs conversation;
// `init { conversation_id }` consumes the freshest unexpired registration and binds it to the
// conversation. Everything lives in process memory — a restart orphans nothing persistent.
// ---------------------------------------------------------------------------

type Registration = { astronautId: string; ts: number };
const registrations = new Map<number, Registration>();
let registrationCounter = 0;

/** Prune registrations older than the TTL. Exported for tests. */
export function pruneRegistrations(now: number = Date.now()): number {
  let pruned = 0;
  for (const [id, reg] of registrations) {
    if (now - reg.ts >= REGISTRATION_TTL_MS) {
      registrations.delete(id);
      pruned += 1;
    }
  }
  return pruned;
}

/** Store a registration (the HUD pick). Prunes expired entries first. */
export function registerSpeechBinding(astronautId: string, now: number = Date.now()): void {
  pruneRegistrations(now);
  if (registrations.size >= MAX_REGISTRATIONS) {
    // Bound memory: drop the oldest registration before accepting a new one.
    let oldestId: number | null = null;
    let oldestTs = Infinity;
    for (const [id, reg] of registrations) {
      if (reg.ts < oldestTs) {
        oldestTs = reg.ts;
        oldestId = id;
      }
    }
    if (oldestId !== null) registrations.delete(oldestId);
  }
  registrationCounter += 1;
  registrations.set(registrationCounter, { astronautId, ts: now });
}

/**
 * Consume the most recent unexpired registration (it is removed so two concurrent conversations
 * never bind to the same pick). Returns null when nothing fresh is pending. Exported for tests.
 */
export function consumeLatestRegistration(now: number = Date.now()): string | null {
  pruneRegistrations(now);
  let bestId: number | null = null;
  let bestTs = -1;
  for (const [id, reg] of registrations) {
    if (reg.ts >= bestTs) {
      bestTs = reg.ts;
      bestId = id;
    }
  }
  if (bestId === null) return null;
  const reg = registrations.get(bestId)!;
  registrations.delete(bestId);
  return reg.astronautId;
}

const conversationBindings = new Map<string, string>();

export function bindConversation(conversationId: string, astronautId: string): void {
  conversationBindings.set(conversationId, astronautId);
  if (conversationBindings.size > MAX_BINDINGS) {
    // Map preserves insertion order — drop the oldest binding.
    const first = conversationBindings.keys().next();
    if (!first.done) conversationBindings.delete(first.value);
  }
}

export function astronautForConversation(conversationId: string): string | null {
  return conversationBindings.get(conversationId) ?? null;
}

function unbindConversation(conversationId: string): void {
  conversationBindings.delete(conversationId);
}

/** Test helper: clears registration slots and conversation bindings. */
export function resetSpeechStateForTests(): void {
  registrations.clear();
  registrationCounter = 0;
  conversationBindings.clear();
}

// ---------------------------------------------------------------------------
// Incremental SSE parser — frames split at any byte boundary, CRLF, and `: ping` keepalives.
// ---------------------------------------------------------------------------

export interface SseFrame {
  type?: string;
  [key: string]: unknown;
}

export interface SseParser {
  /** Feed raw decoded text; returns every complete frame it yields. */
  push(chunk: string): SseFrame[];
  /** Flush at end of stream (a trailing frame without a final blank line is still returned). */
  end(): SseFrame[];
}

export function createSseParser(): SseParser {
  let buffer = "";
  const takeFrames = (endOfStream: boolean): SseFrame[] => {
    const frames: SseFrame[] = [];
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1 || (endOfStream && buffer.length > 0)) {
      let raw: string;
      if (idx === -1) {
        raw = buffer;
        buffer = "";
      } else {
        raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
      }
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue; // comment / keepalive
        if (trimmed.startsWith("data:")) {
          dataLines.push(trimmed.slice(5).trimStart());
        }
      }
      if (dataLines.length === 0) continue;
      try {
        const parsed = JSON.parse(dataLines.join("\n")) as SseFrame;
        frames.push(parsed);
      } catch {
        // Unparseable frame — skip it; the caller treats a missing `done` as an incomplete turn.
      }
    }
    return frames;
  };
  return {
    push: (chunk) => {
      buffer += chunk;
      return takeFrames(false);
    },
    end: () => takeFrames(true),
  };
}

// ---------------------------------------------------------------------------
// Turn adapter — one user transcript in, one `sendResponse` out.
// ---------------------------------------------------------------------------

export type SpeechTurnStatus = "ok" | "error" | "aborted";

export interface RunSpeechTurnArgs {
  astronautId: string;
  message: string;
  /** Aborts the upstream fetch when the user interrupts or the socket closes. */
  signal?: AbortSignal;
  /** Called exactly once on a completed turn (`done` frame). Never on error/abort. */
  sendResponse: (text: string) => void;
  /** Test seam — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Test seam — defaults to `${SKY_WEB_CHAT_URL}/api/chat-stream` or the loopback default. */
  chatUrl?: string;
}

function chatStreamUrl(): string {
  const base = process.env.SKY_WEB_CHAT_URL?.trim().replace(/\/+$/, "");
  if (base) return `${base}/api/chat-stream`;
  return DEFAULT_CHAT_URL;
}

/**
 * Runs one voice turn against the web `/api/chat-stream` SSE pipeline and reports back.
 * Accumulates `delta` text, drops `ui` frames (phase 1), refuses to answer on an `error` frame,
 * and on abort cancels the body without responding. `sendResponse` fires at most once per call.
 */
export async function runSpeechTurn(args: RunSpeechTurnArgs): Promise<SpeechTurnStatus> {
  const { astronautId, message, signal, sendResponse } = args;
  const fetchImpl = args.fetchImpl ?? fetch;
  const url = args.chatUrl ?? chatStreamUrl();

  let full = "";
  let receivedDone = false;
  let sawError = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ astronautId, message, mode: "voice" }),
      // Server-to-server: the web route's sec-fetch-site guard allows a missing header.
      signal: signal ?? null,
    });
    if (!res.ok) {
      console.error(`[speech] chat-stream responded ${res.status}`);
      return "error";
    }
    if (!res.body) {
      console.error("[speech] chat-stream responded with no body");
      return "error";
    }
    reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser();
    const handleFrames = (frames: SseFrame[]) => {
      for (const frame of frames) {
        if (frame.type === "delta" && typeof frame.text === "string") {
          full += frame.text;
        } else if (frame.type === "ui") {
          // Phase 1: generative UI → HUD swap is out of scope for the voice loop.
          console.info("[speech] ui frame dropped (phase 1)");
        } else if (frame.type === "error") {
          console.error(`[speech] chat-stream error frame: ${String(frame.code)}`);
          sawError = true;
        } else if (frame.type === "done") {
          receivedDone = true;
        }
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      handleFrames(parser.push(decoder.decode(value, { stream: true })));
      if (sawError) {
        try {
          await reader.cancel();
        } catch {
          // best effort — we are already bailing out
        }
        return "error";
      }
    }
    handleFrames(parser.end());
    if (sawError) return "error";
    if (signal?.aborted) return "aborted";
    if (!receivedDone) {
      // An upstream that cuts without `done` produced an incomplete turn: no partial answers.
      console.error("[speech] chat-stream ended without a done frame — no response sent");
      return "error";
    }
    sendResponse(full.trim());
    return "ok";
  } catch (err) {
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // already broken
      }
    }
    if (signal?.aborted || (err as { name?: string } | null)?.name === "AbortError") {
      return "aborted";
    }
    console.error("[speech] chat-stream request failed");
    return "error";
  }
}

// ---------------------------------------------------------------------------
// Outgoing frames — shape per the wire protocol (see module header).
// ---------------------------------------------------------------------------

function sendAgentResponse(ws: SpeechSocket, content: string, eventId: number | null): void {
  if (ws.readyState !== 1) return; // OPEN
  try {
    ws.send(JSON.stringify({ type: "agent_response", content, event_id: eventId ?? undefined, is_final: false }));
    ws.send(JSON.stringify({ type: "agent_response", content: "", event_id: eventId ?? undefined, is_final: true }));
  } catch {
    // Socket died mid-turn — nothing more to do.
  }
}

// Structural socket type — apps/backend has no tsconfig and does not import types from "bun".
interface SpeechSocketData {
  conversationId: string | null;
  astronautId: string | null;
  lastEventId: number | null;
  currentAbort: AbortController | null;
}
interface SpeechSocket {
  data: SpeechSocketData;
  send(data: string): unknown;
  close(code?: number, reason?: string): void;
  readyState: number;
}

const transcriptMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});
const incomingMessageSchema = z.object({
  type: z.string(),
  conversation_id: z.string().optional(),
  event_id: z.number().optional(),
  user_transcript: z.array(transcriptMessageSchema).optional(),
  message: z.string().optional(),
});

function freshSocketData(): SpeechSocketData {
  return { conversationId: null, astronautId: null, lastEventId: null, currentAbort: null };
}

function cleanupSocket(ws: SpeechSocket): void {
  ws.data.currentAbort?.abort();
  ws.data.currentAbort = null;
  if (ws.data.conversationId) {
    unbindConversation(ws.data.conversationId);
    ws.data.conversationId = null;
  }
}

function handleInit(ws: SpeechSocket, conversationId: string): void {
  ws.data.conversationId = conversationId;
  const bound = consumeLatestRegistration();
  if (bound) {
    ws.data.astronautId = bound;
  } else {
    console.warn(`[speech] conversation ${conversationId}: no pending registration — falling back to ${DEFAULT_ASTRONAUT}`);
    ws.data.astronautId = DEFAULT_ASTRONAUT;
  }
  bindConversation(conversationId, ws.data.astronautId);
}

function handleUserTranscript(ws: SpeechSocket, transcript: Array<{ role: string; content: string }>, eventId: number | undefined): void {
  const lastUser = [...transcript].reverse().find((m) => m.role === "user" && m.content.length > 0);
  if (!lastUser) return;
  // A new transcript interrupts the in-flight turn (the SDK does the same via abortCurrent()).
  ws.data.currentAbort?.abort();
  const ac = new AbortController();
  ws.data.currentAbort = ac;
  if (typeof eventId === "number" && Number.isFinite(eventId)) {
    ws.data.lastEventId = eventId;
  }
  const astronautId =
    ws.data.astronautId ?? (ws.data.conversationId ? astronautForConversation(ws.data.conversationId) : null) ?? DEFAULT_ASTRONAUT;
  void runSpeechTurn({
    astronautId,
    message: lastUser.content,
    signal: ac.signal,
    sendResponse: (text) => sendAgentResponse(ws, text, ws.data.lastEventId),
  }).then((status) => {
    if (ws.data.currentAbort === ac) ws.data.currentAbort = null;
    if (status === "aborted") console.info("[speech] turn aborted (user interrupted or socket closed)");
  });
}

/** Bun websocket handlers for the speech engine port (same shape as sensors/ws.ts). */
export const speechWsHandlers = {
  data: {} as SpeechSocketData,

  open(ws: SpeechSocket): void {
    ws.data = freshSocketData();
  },

  message(ws: SpeechSocket, message: string | Buffer | ArrayBuffer): void {
    let raw: unknown;
    try {
      raw = JSON.parse(String(message));
    } catch {
      return; // rác — bỏ qua, không đóng connection
    }
    const parsed = incomingMessageSchema.safeParse(raw);
    if (!parsed.success) return;
    const msg = parsed.data;
    switch (msg.type) {
      case "init":
        if (msg.conversation_id) handleInit(ws, msg.conversation_id);
        return;
      case "user_transcript":
        if (msg.user_transcript) handleUserTranscript(ws, msg.user_transcript, msg.event_id);
        return;
      case "ping":
        try {
          ws.send(JSON.stringify({ type: "pong" }));
        } catch {
          // socket died — close handler dọn dẹp
        }
        return;
      case "close":
        cleanupSocket(ws);
        return;
      case "error": {
        const safe = (msg.message ?? "unknown").slice(0, 200);
        console.error(`[speech] engine error: ${safe}`);
        ws.data.currentAbort?.abort();
        return;
      }
      default:
        // Unknown message types are silently ignored (forward-compatible with the protocol).
        return;
    }
  },

  close(ws: SpeechSocket): void {
    cleanupSocket(ws);
  },
};

// ---------------------------------------------------------------------------
// Engine id resolution — env `ELEVENLABS_SPEECH_ENGINE_ID` wins; DB `speech_engine.id` is the
// fallback (set via /admin → "Speech Engine" tab or `settingsRepo.setSpeechEngineId`).
// ---------------------------------------------------------------------------

export type SpeechEngineIdSource = "env" | "db";

export interface EffectiveEngineId {
  engineId: string;
  source: SpeechEngineIdSource;
}

/**
 * Effective engine id: env wins over DB. Blank env values count as unset. Returns null when
 * neither is set (or the DB value is blank). The id is a public instance handle — logging it is fine.
 */
export function resolveEngineId(): EffectiveEngineId | null {
  const fromEnv = process.env.ELEVENLABS_SPEECH_ENGINE_ID?.trim();
  if (fromEnv) return { engineId: fromEnv, source: "env" };
  const fromDb = settingsRepo.getSpeechEngineId();
  if (fromDb) return { engineId: fromDb.engineId, source: "db" };
  return null;
}

// ---------------------------------------------------------------------------
// ElevenLabs API key — env `ELEVENLABS_API_KEY` wins; the /admin key in app_settings is the
// fallback. The value is only ever used for an outbound header: never logged, never returned.
// ---------------------------------------------------------------------------

export type SpeechApiKeySource = "env" | "settings";

export interface SpeechApiKey {
  key: string;
  source: SpeechApiKeySource;
}

/** Resolves the ElevenLabs key server-side. Returns null when neither source is set. */
export function resolveSpeechApiKey(): SpeechApiKey | null {
  const envKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (envKey) return { key: envKey, source: "env" };
  const fromSettings = settingsRepo.getElevenLabsKey();
  if (fromSettings) return { key: fromSettings.key, source: "settings" };
  return null;
}

// ---------------------------------------------------------------------------
// Startup — one process with the HTTP server (called from server.ts). Never throws.
// ---------------------------------------------------------------------------

/** Structural slice of Bun's Server — avoids importing "bun" types in this package. */
export interface SpeechServerHandle {
  stop(closeActiveConnections?: boolean): void | Promise<void>;
}

let speechServer: { server: SpeechServerHandle; port: number } | null = null;
let lastSpeechError: string | null = null;

/**
 * Starts the speech engine websocket server on `127.0.0.1:SPEECH_WS_PORT` (default 3300).
 * JWT verification stays ON; a missing engine id or missing API key (env `ELEVENLABS_API_KEY`,
 * else the /admin key) means the socket never starts — the HTTP routes keep working.
 */
export function startSpeechEngine(): boolean {
  if (speechServer) return true;
  const resolved = resolveEngineId();
  if (!resolved) {
    lastSpeechError = "no engine id (set ELEVENLABS_SPEECH_ENGINE_ID or create one in /admin)";
    console.error("[speech] no engine id (env ELEVENLABS_SPEECH_ENGINE_ID unset and no speech_engine.id in app_settings) — speech engine websocket not started");
    return false;
  }
  const resolvedKey = resolveSpeechApiKey();
  const apiKey = resolvedKey?.key ?? "";
  const source = resolvedKey?.source ?? null;
  if (!apiKey || !source) {
    lastSpeechError = "no ElevenLabs API key (set ELEVENLABS_API_KEY or save one in /admin)";
    console.error("[speech] no ElevenLabs API key (set ELEVENLABS_API_KEY or save one in /admin) — speech engine websocket not started");
    return false;
  }
  let port = Number(process.env.SPEECH_WS_PORT ?? DEFAULT_SPEECH_PORT);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) port = DEFAULT_SPEECH_PORT;
  const keyForVerify = apiKey;
  try {
    const server = Bun.serve({
      port,
      hostname: "127.0.0.1",
      fetch(req, bunServer) {
        // ElevenLabs is the WebSocket client; the JWT rides a custom header on the upgrade.
        const token = req.headers.get("x-elevenlabs-speech-engine-authorization");
        if (!token) {
          return Response.json({ ok: false, error: "missing_token" }, { status: 401 });
        }
        try {
          verifySpeechEngineJwt(token, keyForVerify);
        } catch (err) {
          // Reason only — never the token, never the key.
          console.warn(`[speech] rejected connection: ${(err as Error).message}`);
          return Response.json({ ok: false, error: "invalid_token" }, { status: 401 });
        }
        if (bunServer.upgrade(req, { data: freshSocketData() })) return undefined;
        return new Response("websocket upgrade failed", { status: 400 });
      },
      // Any path is accepted: the port is single-purpose and JWT-gated. The Caddy route strips or
      // preserves `/speech/ws` — both work.
      websocket: { ...speechWsHandlers, maxPayloadLength: 64 * 1024 },
    });
    speechServer = { server, port };
  } catch (err) {
    lastSpeechError = `websocket failed to start on 127.0.0.1:${port}: ${(err as Error).message}`;
    console.error(`[speech] ${lastSpeechError}`);
    return false;
  }
  lastSpeechError = null;
  // Engine id is a public instance handle — logging source and id is fine.
  console.log(`[speech] engine id source: ${resolved.source} (${resolved.engineId})`);
  console.log(`[speech] api key source: ${source}`);
  console.log(`[speech] engine listening on 127.0.0.1:${port} (jwt verify on)`);
  return true;
}

/**
 * Stops the speech engine websocket (closes active sockets). Idempotent. The HTTP routes and the
 * engine id setting are untouched.
 */
export function stopSpeechEngine(): void {
  const current = speechServer;
  speechServer = null;
  if (!current) return;
  try {
    void current.server.stop(true);
    console.log(`[speech] engine websocket stopped on 127.0.0.1:${current.port}`);
  } catch (err) {
    console.error(`[speech] websocket stop failed: ${(err as Error).message}`);
  }
}

/** Stop + start. Returns whether the websocket ended up running. */
export function restartSpeechEngine(): boolean {
  stopSpeechEngine();
  return startSpeechEngine();
}

export interface SpeechEngineStatus {
  wsRunning: boolean;
  port: number;
  lastError: string | null;
  engineId: string | null;
  engineSource: SpeechEngineIdSource | null;
}

/** Local state only — never calls ElevenLabs. */
export function speechEngineStatus(): SpeechEngineStatus {
  const resolved = resolveEngineId();
  let port = Number(process.env.SPEECH_WS_PORT ?? DEFAULT_SPEECH_PORT);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) port = DEFAULT_SPEECH_PORT;
  return {
    wsRunning: speechServer !== null,
    port: speechServer?.port ?? port,
    lastError: lastSpeechError,
    engineId: resolved?.engineId ?? null,
    engineSource: resolved?.source ?? null,
  };
}

// ---------------------------------------------------------------------------
// HTTP routes — /api/speech/register · /api/speech/config (delegated from server.ts).
// ---------------------------------------------------------------------------

const MAX_BODY_BYTES = 4096;
const registerBodySchema = z.object({
  astronautId: z.string().min(1).max(64),
});

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function handleRegister(req: Request): Promise<Response> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const body = safeJsonParse(text);
  if (body === undefined) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const parsed = registerBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const astronaut = await astronautsRepo.get(parsed.data.astronautId);
  if (!astronaut) {
    return Response.json({ ok: false, error: "unknown_astronaut" }, { status: 404 });
  }
  registerSpeechBinding(astronaut.id);
  return Response.json({ ok: true });
}

function handleConfig(): Response {
  const resolved = resolveEngineId();
  if (!resolved) {
    return Response.json({ ok: false, error: "no_engine" }, { status: 404 });
  }
  // engineId is a public instance handle, not a secret — the API key never leaves this process.
  return Response.json({ engineId: resolved.engineId });
}

// ---------------------------------------------------------------------------
// POST /api/speech/token — mint a conversation token server-side.
// The engine is created with `auth.enable_auth: true`, so ElevenLabs connects upstream to our
// websocket WITH the JWT and the browser can no longer mint a token with just the agent id
// (`GET /v1/convai/conversation/token` without a key answers 401). This route holds the key.
// The token is a short-lived conversation credential: it is returned to the caller and never
// logged, and upstream error bodies are never echoed (they can carry account detail).
// ---------------------------------------------------------------------------

const ELEVENLABS_API_BASE = (process.env.ELEVENLABS_API_BASE?.trim().replace(/\/+$/, "") || "https://api.elevenlabs.io");
const TOKEN_UPSTREAM_TIMEOUT_MS = 5_000;

async function handleToken(fetchImpl: typeof fetch): Promise<Response> {
  const resolved = resolveEngineId();
  if (!resolved) {
    return Response.json({ ok: false, error: "no_engine" }, { status: 404 });
  }
  const apiKey = resolveSpeechApiKey();
  if (!apiKey) {
    return Response.json({ ok: false, error: "no_key" }, { status: 503 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetchImpl(
      `${ELEVENLABS_API_BASE}/v1/convai/conversation/token?agent_id=${encodeURIComponent(resolved.engineId)}`,
      {
        method: "GET",
        headers: { "xi-api-key": apiKey.key, accept: "application/json" },
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      // Status only — never the upstream body (account detail), never the key, never a token.
      console.error(`[speech] token upstream status ${res.status}`);
      return Response.json({ ok: false, error: "upstream" }, { status: 502 });
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    const token = (data as { token?: unknown } | null)?.token;
    if (typeof token !== "string" || token.trim().length === 0) {
      console.error("[speech] token upstream status 200 without a usable token");
      return Response.json({ ok: false, error: "upstream" }, { status: 502 });
    }
    return Response.json({ token });
  } catch {
    console.error("[speech] token upstream request failed");
    return Response.json({ ok: false, error: "upstream" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Xử lý `/api/speech/register`, `/api/speech/config` và `/api/speech/token`. Trả về `null` khi
 * path/method không thuộc module để server.ts fall-through về 404. Lỗi luôn JSON `{ ok: false, error }`.
 * `fetchImpl` là test seam (mặc định global fetch).
 */
export async function handleSpeechRequest(req: Request, fetchImpl: typeof fetch = fetch): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname === "/api/speech/register") {
    if (req.method !== "POST") return null;
    return handleRegister(req);
  }
  if (url.pathname === "/api/speech/config") {
    if (req.method !== "GET") return null;
    return handleConfig();
  }
  if (url.pathname === "/api/speech/token") {
    if (req.method !== "POST") return null;
    return handleToken(fetchImpl);
  }
  return null;
}
