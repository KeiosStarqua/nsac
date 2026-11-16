import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setChatSessionFactory, resetChatStateForTests, streamChatTurn } from "./astro-chat.server";
import { resetAgentModelCacheForTests } from "./agent-model.server";
import { setTraceFetch } from "./agent-trace.server";

// The slow-turn contract behind the "Sky could not answer" banner: a reasoning model may take tens of
// seconds to answer, so only the profile's own wall clock (45 s) may end a turn. Anything earlier is
// an abort from the caller — for `/api/chat-stream` that means the reader went away, which is a clean
// cancel (`aborted`), never the `timeout` banner.
type TraceRow = { ok: boolean; errorCode?: string; latencyMs: number };

function slowSession(firstDeltaMs: number, reply = "Steady. Keep the dose.") {
  return (async () => ({
    prompt: (_text: string, opts: { onDelta?: (delta: string) => void; signal?: AbortSignal }) =>
      new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          opts.onDelta?.(reply);
          resolve(reply);
        }, firstDeltaMs);
        opts.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        });
      }),
    dispose: () => {},
  })) as any;
}

function hungSession(onSignal?: (signal: AbortSignal | undefined) => void) {
  let disposed = false;
  const factory = (async () => ({
    prompt: (_text: string, opts: { signal?: AbortSignal }) =>
      new Promise<string>((_resolve, reject) => {
        onSignal?.(opts.signal);
        opts.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    dispose: () => {
      disposed = true;
    },
  })) as any;
  return { factory, wasDisposed: () => disposed };
}

describe("streamChatTurn behind a slow model", () => {
  let dir: string;
  let traces: TraceRow[] = [];
  let logged: string[] = [];
  const prevSessions = process.env.NSAC_SKY_SESSIONS_DIR;
  const prevKey = process.env.SKY_OPENROUTER_API_KEY;
  const prevProvider = process.env.SKY_AGENT_PROVIDER;
  const prevBackend = process.env.BACKEND_URL;
  const prevKeyPath = process.env.NSAC_OPENCODE_KEY_PATH;
  const prevTraceDisabled = process.env.SKY_TRACE_DISABLED;

  const transcript = (id = "ayla-reyes") =>
    JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as { messages: { role: string; text: string }[] };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T00:00:00Z"));
    dir = mkdtempSync(join(tmpdir(), "nsac-sky-slow-"));
    process.env.NSAC_SKY_SESSIONS_DIR = dir;
    process.env.SKY_OPENROUTER_API_KEY = "sk-or-test-fake";
    process.env.SKY_AGENT_PROVIDER = "openrouter";
    process.env.BACKEND_URL = "http://127.0.0.1:1";
    delete process.env.SKY_TRACE_DISABLED;
    process.env.NSAC_OPENCODE_KEY_PATH = join(dir, "no-such-opencode-key.json");
    delete process.env.SKY_OPENCODE_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    traces = [];
    logged = [];
    setTraceFetch((async (_url: URL, init: RequestInit) => {
      traces.push(JSON.parse(String(init.body)) as TraceRow);
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch);
    vi.spyOn(console, "info").mockImplementation((line: unknown) => {
      const text = String(line);
      if (text.startsWith("[sky-turn]")) logged.push(text);
    });
    resetChatStateForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setTraceFetch(null);
    if (prevSessions === undefined) delete process.env.NSAC_SKY_SESSIONS_DIR;
    else process.env.NSAC_SKY_SESSIONS_DIR = prevSessions;
    if (prevKey === undefined) delete process.env.SKY_OPENROUTER_API_KEY;
    else process.env.SKY_OPENROUTER_API_KEY = prevKey;
    if (prevKeyPath === undefined) delete process.env.NSAC_OPENCODE_KEY_PATH;
    else process.env.NSAC_OPENCODE_KEY_PATH = prevKeyPath;
    if (prevTraceDisabled === undefined) delete process.env.SKY_TRACE_DISABLED;
    else process.env.SKY_TRACE_DISABLED = prevTraceDisabled;
    if (prevBackend === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = prevBackend;
    if (prevProvider === undefined) delete process.env.SKY_AGENT_PROVIDER;
    else process.env.SKY_AGENT_PROVIDER = prevProvider;
    setChatSessionFactory(null);
    resetChatStateForTests();
    resetAgentModelCacheForTests();
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it.each([10_000, 30_000, 44_000])("completes a model that answers only after %i ms", async (firstDeltaMs) => {
    const deltas: string[] = [];
    setChatSessionFactory(slowSession(firstDeltaMs));

    const pending = streamChatTurn("ayla-reyes", "How am I?", { onDelta: (delta) => deltas.push(delta) });
    await vi.advanceTimersByTimeAsync(firstDeltaMs);
    const result = await pending;

    expect(result.status).toBe("ok");
    expect(result.reply).toBe("Steady. Keep the dose.");
    expect(deltas).toEqual(["Steady. Keep the dose."]);
    expect(traces.at(-1)).toMatchObject({ ok: true, latencyMs: firstDeltaMs });
    expect(logged.at(-1)).toContain('"outcome":"ok"');
    expect(logged.at(-1)).toContain('"abortFrom":null');
  });

  it("stops a model that never answers at the 45 s profile wall and reports timeout", async () => {
    let seenSignal: AbortSignal | undefined;
    const hung = hungSession((signal) => {
      seenSignal = signal;
    });
    setChatSessionFactory(hung.factory);

    const pending = streamChatTurn("ayla-reyes", "How am I?");
    await vi.advanceTimersByTimeAsync(44_000);
    expect(traces).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1_000);
    const result = await pending;

    expect(result.status).toBe("timeout");
    expect(seenSignal?.aborted).toBe(true);
    expect(hung.wasDisposed()).toBe(true);
    expect(traces.at(-1)).toMatchObject({ ok: false, errorCode: "timeout", latencyMs: 45_000 });
    const line = JSON.parse(logged.at(-1)!.replace("[sky-turn] ", "")) as Record<string, unknown>;
    expect(line).toMatchObject({ outcome: "timeout", abortFrom: "profile-timeout", hooksSignalAborted: false });
    expect(transcript().messages.filter((message) => message.role === "assistant")).toHaveLength(0);
  });

  it("reports a caller cancel as aborted — not as a timeout — and stops the session", async () => {
    let seenSignal: AbortSignal | undefined;
    const hung = hungSession((signal) => {
      seenSignal = signal;
    });
    setChatSessionFactory(hung.factory);

    const caller = new AbortController();
    const pending = streamChatTurn("ayla-reyes", "Update UI", { signal: caller.signal });
    await vi.advanceTimersByTimeAsync(8_000);

    caller.abort();
    await vi.advanceTimersByTimeAsync(0);
    const result = await pending;

    expect(result.status).toBe("aborted");
    expect(seenSignal?.aborted).toBe(true);
    expect(hung.wasDisposed()).toBe(true);
    expect(traces.at(-1)).toMatchObject({ ok: false, errorCode: "aborted", latencyMs: 8_000 });
    const line = JSON.parse(logged.at(-1)!.replace("[sky-turn] ", "")) as Record<string, unknown>;
    expect(line).toMatchObject({ outcome: "aborted", hooksSignalAborted: true });
    expect(String(line.abortFrom)).toMatch(/^external@/);
    expect(transcript().messages.filter((message) => message.role === "assistant")).toHaveLength(0);
  });

  it("keeps the partial text of a cancel out of the transcript but stops generation", async () => {
    const deltas: string[] = [];
    setChatSessionFactory((async () => ({
      prompt: (_text: string, opts: { onDelta?: (delta: string) => void; signal?: AbortSignal }) =>
        new Promise<string>((_resolve, reject) => {
          opts.onDelta?.("partial");
          opts.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      dispose: () => {},
    })) as any);

    const caller = new AbortController();
    const pending = streamChatTurn("ayla-reyes", "How am I?", {
      onDelta: (delta) => deltas.push(delta),
      signal: caller.signal,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    caller.abort();
    await vi.advanceTimersByTimeAsync(0);
    const result = await pending;

    expect(deltas).toEqual(["partial"]);
    expect(result.status).toBe("aborted");
    expect(result.reply).toBeUndefined();
    expect(transcript().messages.filter((message) => message.role === "assistant")).toHaveLength(0);
  });
});
