import "@tanstack/react-start/server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { readOpenRouterKey } from "./pi.server";
import { getAgent } from "../agents/registry";
import { findAstronaut } from "../../astronaut/model/astronauts";
import type { SessionFactory } from "./run.server";
import { sanitizeAstronautId, validateMessage, trimTranscript, MAX_REPLY, MAX_TRANSCRIPT } from "../model/chat";
import type { TranscriptMessage } from "../model/chat";

type SessionFacade = { prompt: (text: string, opts: { onDelta?: (d: string) => void; signal?: AbortSignal }) => Promise<string>; dispose: () => void };

const SESSIONS_DIR = process.env.NSAC_SKY_SESSIONS_DIR?.trim() || join(process.cwd(), "var", "sky-sessions");

function ensureDir() {
  mkdirSync(SESSIONS_DIR, { recursive: true, mode: 0o700 });
}

function transcriptPath(id: string) {
  return join(SESSIONS_DIR, `${id}.json`);
}

function readTranscript(id: string): TranscriptMessage[] {
  const p = transcriptPath(id);
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(raw?.messages) ? raw.messages : [];
  } catch {
    return [];
  }
}

function writeTranscript(id: string, messages: TranscriptMessage[]) {
  ensureDir();
  const p = transcriptPath(id);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify({ messages: trimTranscript(messages) }), { mode: 0o600 });
  renameSync(tmp, p);
}

// cache
type Cached = { session: SessionFacade; lastUsed: number };
const cache = new Map<string, Cached>();
const queues = new Map<string, Promise<unknown>>();

const IDLE_TTL = 20 * 60 * 1000;
const MAX_CACHED = 6;

let factory: SessionFactory | null = null;
export function setChatSessionFactory(f: SessionFactory | null) {
  factory = f;
}

function evictOldest() {
  if (cache.size < MAX_CACHED) return;
  let oldest: string | null = null;
  let oldestTime = Infinity;
  for (const [k, v] of cache) {
    if (v.lastUsed < oldestTime) { oldestTime = v.lastUsed; oldest = k; }
  }
  if (oldest) {
    const c = cache.get(oldest);
    c?.session.dispose();
    cache.delete(oldest);
  }
}

async function getSession(id: string, astronaut: { name: string; role: string; callsign: string }): Promise<SessionFacade> {
  const existing = cache.get(id);
  if (existing && Date.now() - existing.lastUsed < IDLE_TTL) {
    existing.lastUsed = Date.now();
    return existing.session;
  }
  if (existing) {
    existing.session.dispose();
    cache.delete(id);
  }
  evictOldest();
  const profile = getAgent("sky-chat");
  const sessFactory = factory ?? (await import("./pi.server")).createSession;
  let sessionManager: unknown;
  if (!factory) {
    const pi = await import("@earendil-works/pi-coding-agent");
    const sessionFile = join(SESSIONS_DIR, `${id}.jsonl`);
    sessionManager = existsSync(sessionFile)
      ? pi.SessionManager.open(sessionFile, SESSIONS_DIR)
      : pi.SessionManager.create(process.cwd(), SESSIONS_DIR);
  }
  const sess = await (sessFactory as any)(profile, { request: "", astronaut }, sessionManager ? { sessionManager } : undefined);
  cache.set(id, { session: sess, lastUsed: Date.now() });
  return sess;
}

function enqueue(id: string, fn: () => Promise<any>): Promise<any> {
  const prev = queues.get(id) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(id, next);
  return next;
}

export type ChatStatus = "ok" | "missing_key" | "unavailable" | "timeout";

export async function sendChatTurn(astronautIdRaw: string, messageRaw: string) {
  const id = sanitizeAstronautId(astronautIdRaw);
  if (!id) return { status: "unavailable" as ChatStatus };
  const astronaut = findAstronaut(id);
  if (!astronaut) return { status: "unavailable" as ChatStatus };
  const message = validateMessage(messageRaw);
  if (!message) return { status: "unavailable" as ChatStatus };

  if (!readOpenRouterKey()) return { status: "missing_key" as ChatStatus };

  const ctx = { name: astronaut.name, role: astronaut.role, callsign: astronaut.callsign };

  // append user turn
  const msgs = readTranscript(id);
  msgs.push({ role: "user", text: message, at: new Date().toISOString() });
  writeTranscript(id, msgs);

  return enqueue(id, async () => {
    let session: SessionFacade;
    try {
      session = await getSession(id, ctx);
    } catch {
      cache.delete(id);
      return { status: "unavailable" as ChatStatus };
    }
    const ac = new AbortController();
    const profile = getAgent("sky-chat");
    const timer = setTimeout(() => ac.abort(), profile.timeoutMs);
    try {
      const reply = await Promise.race([
        session.prompt(message, { signal: ac.signal }),
        new Promise<string>((_, reject) => ac.signal.addEventListener("abort", () => reject(new Error("timeout")))),
      ]);
      clearTimeout(timer);
      const trimmed = reply.trim().slice(0, MAX_REPLY);
      if (trimmed === "") {
        // Belt and braces: pi.server already throws on empty replies. Never push an empty bubble.
        const cached = cache.get(id);
        cached?.session.dispose();
        cache.delete(id);
        return { status: "unavailable" as ChatStatus };
      }
      const current = readTranscript(id);
      current.push({ role: "assistant", text: trimmed, at: new Date().toISOString() });
      writeTranscript(id, current);
      cache.get(id)!.lastUsed = Date.now();
      return { status: "ok" as ChatStatus, reply: trimmed, messages: readTranscript(id) };
    } catch (e) {
      clearTimeout(timer);
      const cached = cache.get(id);
      cached?.session.dispose();
      cache.delete(id);
      if ((e as { message?: string })?.message === "timeout" || ac.signal.aborted) return { status: "timeout" as ChatStatus };
      return { status: "unavailable" as ChatStatus };
    }
  });
}

export async function loadChatHistory(astronautIdRaw: string) {
  const id = sanitizeAstronautId(astronautIdRaw);
  if (!id) return { messages: [] as TranscriptMessage[] };
  const astronaut = findAstronaut(id);
  if (!astronaut) return { messages: [] as TranscriptMessage[] };
  return { messages: readTranscript(id) };
}