import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test: đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào src/db/*.
// Import động là bắt buộc (giống tts.test.ts) — bun test chia sẻ module cache trong một process.
const dir = mkdtempSync(join(tmpdir(), "sky-speech-test-"));
const dbPath = join(dir, "speech.db");

process.env.SKY_DB_PATH = dbPath;
// Route /api/speech/register cần crew thật trong DB
process.env.SKY_WEB_CHAT_URL = "http://127.0.0.1:1";

type SpeechModule = typeof import("../src/speechEngine");
type AstronautsModule = typeof import("../src/db/repositories/astronauts");

let speech: SpeechModule;
let astronautsRepo: AstronautsModule["astronautsRepo"];

const TEST_API_KEY = `sk_${"b".repeat(48)}`;

const B64U = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
function signJwt(apiKey: string, payload: Record<string, unknown>): string {
  const base = apiKey.trim().replace(/_residency_[a-z0-9]+$/, "");
  const header = B64U(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = B64U(JSON.stringify(payload));
  const secret = createHash("sha256").update(base, "utf-8").digest();
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${B64U(signature)}`;
}
const goodPayload = () => {
  const now = Math.floor(Date.now() / 1000);
  return { iss: "https://api.elevenlabs.io/convai/speech-engine", sub: "convai_speech_engine_upstream", exp: now + 300, iat: now - 1 };
};

beforeAll(async () => {
  speech = await import("../src/speechEngine");
  const a: AstronautsModule = await import("../src/db/repositories/astronauts");
  astronautsRepo = a.astronautsRepo;
  await astronautsRepo.seed();
});

afterEach(() => {
  speech.resetSpeechStateForTests();
  delete process.env.ELEVENLABS_SPEECH_ENGINE_ID;
  delete process.env.ELEVENLABS_API_KEY;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("verifySpeechEngineJwt", () => {
  test("accepts a valid token and returns the payload", () => {
    const token = signJwt(TEST_API_KEY, goodPayload());
    const payload = speech.verifySpeechEngineJwt(token, TEST_API_KEY);
    expect(payload.iss).toBe("https://api.elevenlabs.io/convai/speech-engine");
  });

  test("accepts a `Bearer `-prefixed token", () => {
    const token = `Bearer ${signJwt(TEST_API_KEY, goodPayload())}`;
    expect(() => speech.verifySpeechEngineJwt(token, TEST_API_KEY)).not.toThrow();
  });

  test("accepts a residency-suffixed key (hash of the base key)", () => {
    const resident = `${TEST_API_KEY}_residency_in`;
    const token = signJwt(resident, goodPayload());
    expect(() => speech.verifySpeechEngineJwt(token, resident)).not.toThrow();
  });

  test("rejects a token signed with a different key", () => {
    const token = signJwt(`sk_${"c".repeat(48)}`, goodPayload());
    expect(() => speech.verifySpeechEngineJwt(token, TEST_API_KEY)).toThrow(/signature mismatch/);
  });

  test("a token signed by the right key but with another subject is rejected by the claim check", () => {
    // Correct signature, wrong claim — proves the signature check alone is not enough.
    const token = signJwt(TEST_API_KEY, { ...goodPayload(), sub: "evil" });
    expect(() => speech.verifySpeechEngineJwt(token, TEST_API_KEY)).toThrow(/subject/);
  });

  test("rejects wrong issuer and wrong subject", () => {
    expect(() => speech.verifySpeechEngineJwt(signJwt(TEST_API_KEY, { ...goodPayload(), iss: "https://evil.example" }), TEST_API_KEY)).toThrow(
      /issuer/,
    );
    expect(() =>
      speech.verifySpeechEngineJwt(signJwt(TEST_API_KEY, { ...goodPayload(), sub: "convai_other" }), TEST_API_KEY),
    ).toThrow(/subject/);
  });

  test("rejects expired and future-iat tokens", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(() => speech.verifySpeechEngineJwt(signJwt(TEST_API_KEY, { ...goodPayload(), exp: now - 3600 }), TEST_API_KEY)).toThrow(/expired/);
    expect(() => speech.verifySpeechEngineJwt(signJwt(TEST_API_KEY, { ...goodPayload(), iat: now + 3600 }), TEST_API_KEY)).toThrow(/iat is in the future/);
  });

  test("rejects malformed tokens (wrong part count, non-JSON payload)", () => {
    expect(() => speech.verifySpeechEngineJwt("a.b", TEST_API_KEY)).toThrow(/3 parts/);
    expect(() => speech.verifySpeechEngineJwt("a.!!!.c", TEST_API_KEY)).toThrow(/decode payload/);
  });

  test("does not leak key material in thrown messages", () => {
    const token = signJwt(`sk_${"d".repeat(48)}`, goodPayload());
    try {
      speech.verifySpeechEngineJwt(token, TEST_API_KEY);
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).not.toContain(TEST_API_KEY);
      expect((err as Error).message).not.toContain(token);
    }
  });
});

describe("registration slot", () => {
  test("consume returns null when nothing was registered", () => {
    expect(speech.consumeLatestRegistration()).toBeNull();
  });

  test("most recent unexpired registration wins", () => {
    const now = Date.now();
    speech.registerSpeechBinding("ayla-reyes", now - 5_000);
    speech.registerSpeechBinding("dae-jung-park", now - 1_000);
    expect(speech.consumeLatestRegistration(now)).toBe("dae-jung-park");
  });

  test("consuming removes the registration (no double-bind)", () => {
    const now = Date.now();
    speech.registerSpeechBinding("ayla-reyes", now);
    expect(speech.consumeLatestRegistration(now)).toBe("ayla-reyes");
    expect(speech.consumeLatestRegistration(now)).toBeNull();
  });

  test("registrations older than 10 minutes are pruned", () => {
    const now = Date.now();
    speech.registerSpeechBinding("yuki-tanaka", now - speech.REGISTRATION_TTL_MS - 1);
    expect(speech.consumeLatestRegistration(now)).toBeNull();
  });

  test("pruneRegistrations reports how many were dropped", () => {
    const now = Date.now();
    // Inserting a fresh registration prunes expired ones as a side effect, so seed the stale
    // entry and assert the explicit prune call removes it.
    speech.registerSpeechBinding("ayla-reyes", now - speech.REGISTRATION_TTL_MS - 1);
    expect(speech.pruneRegistrations(now)).toBe(1);
    expect(speech.consumeLatestRegistration(now)).toBeNull();
  });
});

describe("runSpeechTurn", () => {
  const sse = (frames: unknown[]): Response =>
    new Response(
      frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join(""),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );

  test("delta frames accumulate and exactly one sendResponse fires on done", async () => {
    const responses: string[] = [];
    const fetchImpl = (async (_url: string | URL | Request, _init?: RequestInit) =>
      sse([
        { type: "delta", text: "Readiness is " },
        { type: "delta", text: "stable at 86." },
        { type: "ui", program: "ignored" },
        { type: "done" },
      ])) as unknown as typeof fetch;
    const status = await speech.runSpeechTurn({
      astronautId: "ayla-reyes",
      message: "How is my readiness?",
      sendResponse: (text) => responses.push(text),
      fetchImpl,
    });
    expect(status).toBe("ok");
    expect(responses).toEqual(["Readiness is stable at 86."]);
  });

  test("an error frame produces no sendResponse", async () => {
    const responses: string[] = [];
    const fetchImpl = (async () => sse([{ type: "delta", text: "partial" }, { type: "error", code: "timeout" }])) as unknown as typeof fetch;
    const status = await speech.runSpeechTurn({
      astronautId: "ayla-reyes",
      message: "hi",
      sendResponse: (t) => responses.push(t),
      fetchImpl,
    });
    expect(status).toBe("error");
    expect(responses).toEqual([]);
  });

  test("a stream cut without a done frame produces no sendResponse", async () => {
    const responses: string[] = [];
    const fetchImpl = (async () => sse([{ type: "delta", text: "partial answer" }])) as unknown as typeof fetch;
    const status = await speech.runSpeechTurn({
      astronautId: "ayla-reyes",
      message: "hi",
      sendResponse: (t) => responses.push(t),
      fetchImpl,
    });
    expect(status).toBe("error");
    expect(responses).toEqual([]);
  });

  test("a non-2xx upstream produces no sendResponse", async () => {
    const responses: string[] = [];
    const fetchImpl = (async () => new Response("bad", { status: 503 })) as unknown as typeof fetch;
    const status = await speech.runSpeechTurn({
      astronautId: "ayla-reyes",
      message: "hi",
      sendResponse: (t) => responses.push(t),
      fetchImpl,
    });
    expect(status).toBe("error");
    expect(responses).toEqual([]);
  });

  test("abort cancels the upstream read and no sendResponse fires", async () => {
    const controller = new AbortController();
    const responses: string[] = [];
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        streamController = c;
        c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "delta", text: "partial" })}\n\n`));
        // Never closes — the abort must interrupt the pending read.
      },
    });
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      // Real fetch semantics on abort: the response body errors with AbortError.
      controller.signal?.addEventListener("abort", () => {
        streamController?.error(new DOMException("The operation was aborted.", "AbortError"));
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    }) as unknown as typeof fetch;
    const runPromise = speech.runSpeechTurn({
      astronautId: "ayla-reyes",
      message: "hi",
      signal: controller.signal,
      sendResponse: (t) => responses.push(t),
      fetchImpl,
    });
    setTimeout(() => controller.abort(), 20);
    const status = await runPromise;
    expect(status).toBe("aborted");
    expect(responses).toEqual([]);
  });

  test("frames are parsed across chunk boundaries (split mid-frame)", async () => {
    const responses: string[] = [];
    const payload = `data: ${JSON.stringify({ type: "delta", text: "hello " })}\n\ndata: ${JSON.stringify({ type: "done" })}\n\n`;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(c) {
        // Split inside the first frame — the SSE parser must hold the partial frame back.
        c.enqueue(encoder.encode(payload.slice(0, payload.indexOf("hello") + 2)));
        await new Promise((resolve) => setTimeout(resolve, 10));
        c.enqueue(encoder.encode(payload.slice(payload.indexOf("hello") + 2)));
        c.close();
      },
    });
    const fetchImpl = (async () => new Response(stream, { status: 200 })) as unknown as typeof fetch;
    const status = await speech.runSpeechTurn({
      astronautId: "ayla-reyes",
      message: "hi",
      sendResponse: (t) => responses.push(t),
      fetchImpl,
    });
    expect(status).toBe("ok");
    expect(responses).toEqual(["hello"]);
  });
});

describe("HTTP routes", () => {
  const post = (body: unknown, raw?: string, headers: Record<string, string> = {}) =>
    speech.handleSpeechRequest(
      new Request("http://test/api/speech/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: raw ?? JSON.stringify(body),
      }),
    );

  test("POST /api/speech/register binds a known astronaut", async () => {
    const res = await post({ astronautId: "ayla-reyes" });
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ ok: true });
    expect(speech.consumeLatestRegistration()).toBe("ayla-reyes");
  });

  test("POST /api/speech/register 404s on an unknown astronaut", async () => {
    const res = await post({ astronautId: "nope" });
    expect(res?.status).toBe(404);
    expect(await res?.json()).toEqual({ ok: false, error: "unknown_astronaut" });
  });

  test("POST /api/speech/register 400s on a bad body", async () => {
    expect((await post({ astronautId: "" }))?.status).toBe(400);
    expect((await post({ astronautId: "x".repeat(65) }))?.status).toBe(400);
    expect((await post(undefined, "not json"))?.status).toBe(400);
  });

  test("GET /api/speech/config 404s with no_engine when the env var is unset", async () => {
    delete process.env.ELEVENLABS_SPEECH_ENGINE_ID;
    const res = await speech.handleSpeechRequest(new Request("http://test/api/speech/config"));
    expect(res?.status).toBe(404);
    expect(await res?.json()).toEqual({ ok: false, error: "no_engine" });
  });

  test("GET /api/speech/config returns the engine id when set", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "seng_test123";
    const res = await speech.handleSpeechRequest(new Request("http://test/api/speech/config"));
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ engineId: "seng_test123" });
  });

  test("unrelated paths fall through with null", async () => {
    expect(await speech.handleSpeechRequest(new Request("http://test/api/speech/other"))).toBeNull();
  });
});

describe("POST /api/speech/token", () => {
  const postToken = (fetchImpl?: typeof fetch) =>
    speech.handleSpeechRequest(new Request("http://test/api/speech/token", { method: "POST" }), fetchImpl);

  const jsonRes = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  test("mints the token upstream with the engine id and the key header, then passes { token } through", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "seng_token_1";
    process.env.ELEVENLABS_API_KEY = TEST_API_KEY;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return jsonRes({ token: "conv_token_abc" });
    }) as unknown as typeof fetch;

    const res = await postToken(fetchImpl);
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ token: "conv_token_abc" });
    expect(calls[0]?.url).toBe("https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=seng_token_1");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe(TEST_API_KEY);
  });

  test("404 no_engine when no engine id is configured", async () => {
    delete process.env.ELEVENLABS_SPEECH_ENGINE_ID;
    const settings = await import("../src/db/repositories/settings");
    settings.settingsRepo.clearSpeechEngineId();
    process.env.ELEVENLABS_API_KEY = TEST_API_KEY;
    const fetchImpl = (async () => jsonRes({ token: "never" })) as unknown as typeof fetch;
    const res = await postToken(fetchImpl);
    expect(res?.status).toBe(404);
    expect(await res?.json()).toEqual({ ok: false, error: "no_engine" });
  });

  test("503 no_key when neither env nor the /admin key is set", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "seng_token_2";
    delete process.env.ELEVENLABS_API_KEY;
    const settings = await import("../src/db/repositories/settings");
    settings.settingsRepo.clearElevenLabsKey();
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return jsonRes({ token: "never" });
    }) as unknown as typeof fetch;
    const res = await postToken(fetchImpl);
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ ok: false, error: "no_key" });
    expect(called).toBe(false);
  });

  test("upstream error → 502 upstream without echoing upstream's body", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "seng_token_3";
    process.env.ELEVENLABS_API_KEY = TEST_API_KEY;
    for (const status of [401, 500]) {
      const fetchImpl = (async () =>
        jsonRes({ detail: { message: "account_quota_exhausted", account_id: "acct_secret" } }, status)) as unknown as typeof fetch;
      const res = await postToken(fetchImpl);
      expect(res?.status).toBe(502);
      const text = await res!.text();
      expect(JSON.parse(text)).toEqual({ ok: false, error: "upstream" });
      expect(text).not.toContain("acct_secret");
      expect(text).not.toContain("account_quota_exhausted");
      expect(text).not.toContain(TEST_API_KEY);
    }
  });

  test("unreachable upstream → 502 upstream", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "seng_token_4";
    process.env.ELEVENLABS_API_KEY = TEST_API_KEY;
    const fetchImpl = (async () => Promise.reject(new Error("down"))) as unknown as typeof fetch;
    const res = await postToken(fetchImpl);
    expect(res?.status).toBe(502);
    expect(await res?.json()).toEqual({ ok: false, error: "upstream" });
  });

  test("a 200 without a usable token → 502 upstream", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "seng_token_5";
    process.env.ELEVENLABS_API_KEY = TEST_API_KEY;
    for (const body of [{}, { token: "" }, { token: 7 }, null]) {
      const fetchImpl = (async () => jsonRes(body)) as unknown as typeof fetch;
      const res = await postToken(fetchImpl);
      expect(res?.status).toBe(502);
      expect(await res?.json()).toEqual({ ok: false, error: "upstream" });
    }
  });

  test("non-POST /api/speech/token falls through with null", async () => {
    expect(await speech.handleSpeechRequest(new Request("http://test/api/speech/token"))).toBeNull();
    expect(await speech.handleSpeechRequest(new Request("http://test/api/speech/token", { method: "PUT" }))).toBeNull();
    // Unrelated paths keep falling through too.
    expect(await speech.handleSpeechRequest(new Request("http://test/api/speech/other", { method: "POST" }))).toBeNull();
  });
});
