import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordTurnTrace,
  setTraceFetch,
  type RecordTurnTraceInput,
} from "./agent-trace.server";
import {
  setChatSessionFactory,
  resetChatStateForTests,
  sendChatTurn,
} from "./astro-chat.server";
import {
  composeHud,
  setHudSessionFactory,
  resetHudComposeStateForTests,
} from "./hud-compose.server";
import { resetAgentModelCacheForTests } from "./agent-model.server";
import { HUD_PRESET_EN } from "../../hud-gen/presets";

// Trace writer + turn-pipeline wiring. Mỗi test dùng tmp sessions dir và fake trace fetch —
// không bao giờ chạm network hay var/sky.db thật.
describe("agent-trace", () => {
  let dir: string;
  const prevSessions = process.env.NSAC_SKY_SESSIONS_DIR;
  const prevKey = process.env.SKY_OPENROUTER_API_KEY;
  const prevProvider = process.env.SKY_AGENT_PROVIDER;
  const prevBackend = process.env.BACKEND_URL;
  const prevDisabled = process.env.SKY_TRACE_DISABLED;

  const captured: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fakeFetch = (async (input: unknown, init?: { body?: string }) => {
    captured.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ id: captured.length }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  const validInput: RecordTurnTraceInput = {
    astronautId: "ayla-reyes",
    agentId: "sky-chat",
    sessionId: "ayla-reyes",
    provider: "openrouter",
    model: "test/model",
    ok: true,
    latencyMs: 120,
    userText: "hello",
    replyText: "hi",
    tools: [{ name: "show_on_hud", ok: true, ms: 30 }],
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nsac-trace-test-"));
    process.env.NSAC_SKY_SESSIONS_DIR = dir;
    process.env.SKY_OPENROUTER_API_KEY = "sk-or-test-fake";
    process.env.SKY_AGENT_PROVIDER = "openrouter";
    process.env.BACKEND_URL = "http://127.0.0.1:1"; // không backend thật trong test
    delete process.env.SKY_TRACE_DISABLED;
    captured.length = 0;
    setTraceFetch(fakeFetch);
    setChatSessionFactory(null);
    setHudSessionFactory(null);
    resetChatStateForTests();
    resetHudComposeStateForTests();
    resetAgentModelCacheForTests();
  });

  afterEach(() => {
    setTraceFetch(null);
    setChatSessionFactory(null);
    setHudSessionFactory(null);
    resetChatStateForTests();
    resetHudComposeStateForTests();
    resetAgentModelCacheForTests();
    if (prevSessions === undefined) delete process.env.NSAC_SKY_SESSIONS_DIR;
    else process.env.NSAC_SKY_SESSIONS_DIR = prevSessions;
    if (prevKey === undefined) delete process.env.SKY_OPENROUTER_API_KEY;
    else process.env.SKY_OPENROUTER_API_KEY = prevKey;
    if (prevProvider === undefined) delete process.env.SKY_AGENT_PROVIDER;
    else process.env.SKY_AGENT_PROVIDER = prevProvider;
    if (prevBackend === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = prevBackend;
    if (prevDisabled === undefined) delete process.env.SKY_TRACE_DISABLED;
    else process.env.SKY_TRACE_DISABLED = prevDisabled;
    rmSync(dir, { recursive: true, force: true });
  });

  it("writer posts the trace to /api/agent-traces and returns true", async () => {
    const ok = await recordTurnTrace(validInput);
    expect(ok).toBe(true);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toBe("http://127.0.0.1:1/api/agent-traces");
    expect(captured[0]!.body).toMatchObject({
      astronautId: "ayla-reyes",
      agentId: "sky-chat",
      ok: true,
      userText: "hello",
      replyText: "hi",
      tools: [{ name: "show_on_hud", ok: true, ms: 30 }],
    });
  });

  it("writer never throws: network failure returns false", async () => {
    setTraceFetch((async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch);
    await expect(recordTurnTrace(validInput)).resolves.toBe(false);
  });

  it("writer is disabled by SKY_TRACE_DISABLED=1 and does no fetch", async () => {
    process.env.SKY_TRACE_DISABLED = "1";
    const ok = await recordTurnTrace(validInput);
    expect(ok).toBe(false);
    expect(captured).toHaveLength(0);
  });

  it("writer reports false when the backend answers non-2xx", async () => {
    setTraceFetch((async () => new Response("nope", { status: 500 })) as unknown as typeof fetch);
    await expect(recordTurnTrace(validInput)).resolves.toBe(false);
  });

  it("writer aborts after the 1200 ms timeout", async () => {
    vi.useFakeTimers();
    try {
      setTraceFetch(((_input: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        })) as unknown as typeof fetch);
      const pending = recordTurnTrace(validInput);
      await vi.advanceTimersByTimeAsync(1300);
      await expect(pending).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("an agent turn (chat) writes an ok trace on the success path", async () => {
    setChatSessionFactory((async () => ({ prompt: async () => "reply", dispose: () => {} })) as never);
    const r = await sendChatTurn("ayla-reyes", "hello");
    expect(r.status).toBe("ok");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.body).toMatchObject({
      astronautId: "ayla-reyes",
      agentId: "sky-chat",
      ok: true,
      userText: "hello",
      replyText: "reply",
      provider: "openrouter",
    });
    expect(typeof captured[0]!.body.latencyMs).toBe("number");
    expect(captured[0]!.body.errorCode).toBeUndefined();
  });

  it("an agent turn (chat) writes a session_failed trace when the factory throws", async () => {
    setChatSessionFactory((async () => {
      throw new Error("boom");
    }) as never);
    const r = await sendChatTurn("ayla-reyes", "hello");
    expect(r.status).toBe("unavailable");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.body).toMatchObject({ agentId: "sky-chat", ok: false, errorCode: "session_failed" });
  });

  it("an agent turn (chat) writes an empty_reply trace when the session answers with nothing", async () => {
    setChatSessionFactory((async () => ({ prompt: async () => "", dispose: () => {} })) as never);
    const r = await sendChatTurn("ayla-reyes", "hello");
    expect(r.status).toBe("unavailable");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.body).toMatchObject({ agentId: "sky-chat", ok: false, errorCode: "empty_reply" });
  });

  it("an agent turn (chat) writes the SDK tool outcomes captured via tool_execution_end", async () => {
    setChatSessionFactory((async (_profile: unknown, _ctx: unknown, overrides: { artifacts: { tools?: Array<{ name: string; ok: boolean; ms?: number }> } }) => {
      overrides.artifacts.tools = [{ name: "show_on_hud", ok: true, ms: 25 }];
      return { prompt: async () => "reply", dispose: () => {} };
    }) as never);
    const r = await sendChatTurn("ayla-reyes", "show me my heart rate");
    expect(r.status).toBe("ok");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.body.tools).toEqual([{ name: "show_on_hud", ok: true, ms: 25 }]);
  });

  it("an agent turn (chat) falls back to the show_on_hud artifact when no SDK tool events were captured", async () => {
    setChatSessionFactory((async (_profile: unknown, _ctx: unknown, overrides: { artifacts: { hudProgram?: string } }) => {
      overrides.artifacts.hudProgram = "root = Surface([])";
      return { prompt: async () => "reply", dispose: () => {} };
    }) as never);
    const r = await sendChatTurn("ayla-reyes", "show me");
    expect(r.status).toBe("ok");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.body.tools).toEqual([{ name: "show_on_hud", ok: true }]);
  });

  it("a composer turn (hud-compose) writes a trace with agentId sky-hud-composer", async () => {
    setHudSessionFactory((async () => ({ prompt: async () => HUD_PRESET_EN, dispose: () => {} })) as never);
    const r = await composeHud("ayla-reyes", "en");
    expect(r.status).toBe("ok");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.body).toMatchObject({
      astronautId: "ayla-reyes",
      agentId: "sky-hud-composer",
      ok: true,
    });
    expect(captured[0]!.body.sessionId).toBe("ayla-reyes.hud");
  });

  it("a composer rejection writes a trace with errorCode rejected", async () => {
    setHudSessionFactory((async () => ({ prompt: async () => "root = Surface([bogus])", dispose: () => {} })) as never);
    const r = await composeHud("ayla-reyes", "en");
    expect(r.status).toBe("rejected");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.body).toMatchObject({ agentId: "sky-hud-composer", ok: false, errorCode: "rejected" });
  });
});
