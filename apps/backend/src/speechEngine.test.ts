import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test: đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào src/db/*.
// Import động là bắt buộc (giống speechAdmin.test.ts) — bun test chia sẻ module cache trong một process.
// Port WS riêng để không đụng 3300 (mặc định production) hay các file test khác (3391 = speechAdmin).
const dir = mkdtempSync(join(tmpdir(), "sky-speech-engine-test-"));
const dbPath = join(dir, "speech-engine.db");

process.env.SKY_DB_PATH = dbPath;
process.env.SPEECH_WS_PORT = "3392";
// Không được để trỏ tới mạng thật nếu có test lỡ gọi fetch toàn cục.
process.env.SKY_WEB_CHAT_URL = "http://127.0.0.1:1";
delete process.env.SKY_SPEECH_DEBOUNCE_MS;
delete process.env.ELEVENLABS_SPEECH_ENGINE_ID;
delete process.env.ELEVENLABS_API_KEY;

const TEST_API_KEY = `sk_${"e".repeat(48)}`;
const originalFetch = globalThis.fetch;

type SpeechModule = typeof import("./speechEngine");
type SpeechSocketArg = Parameters<SpeechModule["speechWsHandlers"]["open"]>[0];

let speech: SpeechModule;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sse = (frames: unknown[]): Response =>
  new Response(frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join(""), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });

/** Mock SpeechSocket — ghi lại mọi frame đã send; đủ để drive `speechWsHandlers` mà không cần mạng. */
function mockSocket(): { ws: SpeechSocketArg; sent: string[] } {
  const sent: string[] = [];
  const newWs = {
    data: undefined as unknown as SpeechSocketArg["data"],
    readyState: 1,
    send: (s: string) => {
      sent.push(s);
      return 1;
    },
    close: () => {
      newWs.readyState = 3;
    },
  };
  return { ws: newWs as SpeechSocketArg, sent };
}

/** fetch stub toàn cục — ghi lại call; KHÔNG bao giờ chạm mạng. */
function stubGlobalFetch(impl: (input: unknown, init?: RequestInit) => Promise<Response>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return impl(input, init);
  }) as unknown as typeof fetch;
  return calls;
}

beforeAll(async () => {
  speech = await import("./speechEngine");
});

beforeEach(() => {
  speech.resetSpeechStateForTests();
});

afterEach(() => {
  speech.stopSpeechEngine();
  speech.resetSpeechStateForTests();
  globalThis.fetch = originalFetch;
  delete process.env.SKY_SPEECH_DEBOUNCE_MS;
  delete process.env.ELEVENLABS_SPEECH_ENGINE_ID;
  delete process.env.ELEVENLABS_API_KEY;
});

afterAll(() => {
  speech.stopSpeechEngine();
  rmSync(dir, { recursive: true, force: true });
});

describe("runSpeechTurn streaming", () => {
  test("delta frames stream through onDelta in order, before sendResponse fires on done", async () => {
    const order: string[] = [];
    const deltas: string[] = [];
    const responses: string[] = [];
    const fetchImpl = (async () =>
      sse([
        { type: "delta", text: "Readiness " },
        { type: "delta", text: "is stable" },
        { type: "ui", program: "ignored" },
        { type: "done" },
      ])) as unknown as typeof fetch;
    const status = await speech.runSpeechTurn({
      astronautId: "ayla-reyes",
      message: "How is my readiness?",
      onDelta: (text) => {
        deltas.push(text);
        order.push(`delta:${text}`);
      },
      sendResponse: (text) => {
        responses.push(text);
        order.push(`done:${text}`);
      },
      fetchImpl,
    });
    expect(status).toBe("ok");
    expect(deltas).toEqual(["Readiness ", "is stable"]);
    expect(responses).toEqual(["Readiness is stable"]);
    // onDelta calls all happen before the completion callback, in order.
    expect(order).toEqual(["delta:Readiness ", "delta:is stable", "done:Readiness is stable"]);
  });

  test("empty delta text is accumulated but not streamed", async () => {
    const deltas: string[] = [];
    const fetchImpl = (async () =>
      sse([
        { type: "delta", text: "" },
        { type: "delta", text: "hi" },
        { type: "done" },
      ])) as unknown as typeof fetch;
    const status = await speech.runSpeechTurn({
      astronautId: "ayla-reyes",
      message: "hi",
      onDelta: (t) => deltas.push(t),
      sendResponse: () => {},
      fetchImpl,
    });
    expect(status).toBe("ok");
    expect(deltas).toEqual(["hi"]);
  });

  test("an error frame stops deltas — nothing streamed after it, sendResponse never fires", async () => {
    const deltas: string[] = [];
    const responses: string[] = [];
    // Frames after the error arrive in the same chunk — onDelta must NOT run for them.
    const fetchImpl = (async () =>
      sse([
        { type: "delta", text: "partial" },
        { type: "error", code: "timeout" },
        { type: "delta", text: "after-error" },
      ])) as unknown as typeof fetch;
    const status = await speech.runSpeechTurn({
      astronautId: "ayla-reyes",
      message: "hi",
      onDelta: (t) => deltas.push(t),
      sendResponse: (t) => responses.push(t),
      fetchImpl,
    });
    expect(status).toBe("error");
    expect(deltas).toEqual(["partial"]);
    expect(responses).toEqual([]);
  });

  test("a throwing onDelta does not corrupt the turn outcome", async () => {
    const responses: string[] = [];
    const fetchImpl = (async () =>
      sse([
        { type: "delta", text: "a" },
        { type: "delta", text: "b" },
        { type: "done" },
      ])) as unknown as typeof fetch;
    const status = await speech.runSpeechTurn({
      astronautId: "ayla-reyes",
      message: "hi",
      onDelta: () => {
        throw new Error("socket died");
      },
      sendResponse: (t) => responses.push(t),
      fetchImpl,
    });
    expect(status).toBe("ok");
    expect(responses).toEqual(["ab"]);
  });
});

describe("speechDebounceMs", () => {
  test("defaults to 800 when unset", () => {
    delete process.env.SKY_SPEECH_DEBOUNCE_MS;
    expect(speech.SPEECH_DEBOUNCE_MS).toBe(800);
    expect(speech.speechDebounceMs()).toBe(800);
  });

  test("env override is clamped to 300–3000; invalid falls back to default", () => {
    process.env.SKY_SPEECH_DEBOUNCE_MS = "50";
    expect(speech.speechDebounceMs()).toBe(300);
    process.env.SKY_SPEECH_DEBOUNCE_MS = "900";
    expect(speech.speechDebounceMs()).toBe(900);
    process.env.SKY_SPEECH_DEBOUNCE_MS = "99999";
    expect(speech.speechDebounceMs()).toBe(3000);
    process.env.SKY_SPEECH_DEBOUNCE_MS = "not-a-number";
    expect(speech.speechDebounceMs()).toBe(800);
    process.env.SKY_SPEECH_DEBOUNCE_MS = "";
    expect(speech.speechDebounceMs()).toBe(800);
  });
});

describe("transcript debounce (socket handlers)", () => {
  const refinement = (content: string, eventId: number) =>
    JSON.stringify({
      type: "user_transcript",
      event_id: eventId,
      user_transcript: [{ role: "user", content }],
    });

  test("rapid refinements fire exactly one turn, with the latest content", async () => {
    process.env.SKY_SPEECH_DEBOUNCE_MS = "300";
    speech.registerSpeechBinding("ayla-reyes");
    const calls = stubGlobalFetch(async () =>
      sse([
        { type: "delta", text: "Vài " },
        { type: "delta", text: "dòng." },
        { type: "done" },
      ]),
    );
    const { ws, sent } = mockSocket();
    speech.speechWsHandlers.open(ws);
    speech.speechWsHandlers.message(ws, JSON.stringify({ type: "init", conversation_id: "conv_debounce_1" }));
    speech.speechWsHandlers.message(ws, refinement("Tình hình", 1));
    speech.speechWsHandlers.message(ws, refinement("Tình hình của", 2));
    speech.speechWsHandlers.message(ws, refinement("Tình hình của bảy ngày qua", 3));
    expect(calls.length).toBe(0); // debounced — không turn nào bắt đầu ngay
    await sleep(450);
    expect(calls.length).toBe(1);
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(body.message).toBe("Tình hình của bảy ngày qua");
    expect(body.mode).toBe("voice");
    expect(body.astronautId).toBe("ayla-reyes");
    // Frames wire: deltas (is_final:false) theo thứ tự, sau cùng một frame final is_final:true.
    await sleep(50);
    const frames = sent.map((s) => JSON.parse(s) as Record<string, unknown>);
    const deltas = frames.filter((f) => f.is_final === false);
    const finals = frames.filter((f) => f.is_final === true);
    expect(deltas.map((f) => f.content)).toEqual(["Vài ", "dòng."]);
    expect(finals).toHaveLength(1);
    expect(finals[0]).toMatchObject({ type: "agent_response", content: "", event_id: 3, is_final: true });
    expect(deltas.every((f) => f.type === "agent_response" && f.event_id === 3)).toBe(true);
  });

  test("a pure duplicate refinement is ignored and does not re-arm the timer", async () => {
    process.env.SKY_SPEECH_DEBOUNCE_MS = "300";
    const calls = stubGlobalFetch(async () => sse([{ type: "done" }]));
    const { ws } = mockSocket();
    speech.speechWsHandlers.open(ws);
    speech.speechWsHandlers.message(ws, JSON.stringify({ type: "init", conversation_id: "conv_debounce_2" }));
    speech.speechWsHandlers.message(ws, refinement("Tình hình", 1));
    // Chờ hơn nửa debounce rồi gửi trùng — timer đầu vẫn theo hạn cũ.
    await sleep(120);
    speech.speechWsHandlers.message(ws, refinement("Tình hình", 2));
    await sleep(250);
    expect(calls.length).toBe(1);
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(body.message).toBe("Tình hình");
  });

  test("socket close cancels the pending debounced turn — no fetch fires after close", async () => {
    process.env.SKY_SPEECH_DEBOUNCE_MS = "300";
    const calls = stubGlobalFetch(async () => sse([{ type: "done" }]));
    const { ws } = mockSocket();
    speech.speechWsHandlers.open(ws);
    speech.speechWsHandlers.message(ws, JSON.stringify({ type: "init", conversation_id: "conv_debounce_3" }));
    speech.speechWsHandlers.message(ws, refinement("hello there", 1));
    speech.speechWsHandlers.close(ws);
    await sleep(450);
    expect(calls.length).toBe(0);
  });

  test("engine error message cancels the pending debounced turn", async () => {
    process.env.SKY_SPEECH_DEBOUNCE_MS = "300";
    const calls = stubGlobalFetch(async () => sse([{ type: "done" }]));
    const { ws } = mockSocket();
    speech.speechWsHandlers.open(ws);
    speech.speechWsHandlers.message(ws, JSON.stringify({ type: "init", conversation_id: "conv_debounce_4" }));
    speech.speechWsHandlers.message(ws, refinement("hello there", 1));
    speech.speechWsHandlers.message(ws, JSON.stringify({ type: "error", message: "engine blew up" }));
    await sleep(450);
    expect(calls.length).toBe(0);
  });

  test("a new utterance while the agent is answering aborts the in-flight turn and re-arms the debounce", async () => {
    process.env.SKY_SPEECH_DEBOUNCE_MS = "300";
    let sawAbort = false;
    const calls = stubGlobalFetch(async (input, init) => {
      void input;
      // Lượt đầu giữ stream treo cho tới khi bị abort; lượt sau trả lời xong ngay.
      const message = (JSON.parse(String(init?.body)) as { message: string }).message;
      if (message === "first utterance") {
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            init?.signal?.addEventListener("abort", () => {
              sawAbort = true;
              c.error(new DOMException("The operation was aborted.", "AbortError"));
            });
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return sse([{ type: "delta", text: "second answer" }, { type: "done" }]);
    });
    const { ws, sent } = mockSocket();
    speech.speechWsHandlers.open(ws);
    speech.speechWsHandlers.message(ws, JSON.stringify({ type: "init", conversation_id: "conv_debounce_5" }));
    speech.speechWsHandlers.message(ws, refinement("first utterance", 1));
    await sleep(400); // lượt đầu đã bắt đầu
    expect(calls.length).toBe(1);
    speech.speechWsHandlers.message(ws, refinement("second utterance", 2));
    await sleep(450); // debounce của lượt hai
    expect(sawAbort).toBe(true);
    expect(calls.length).toBe(2);
    expect((JSON.parse(String(calls[1]?.init?.body)) as { message: string }).message).toBe("second utterance");
    // Lượt thứ hai chạy xong: ít nhất một delta frame + final frame trên socket.
    const frames = sent.map((s) => JSON.parse(s) as Record<string, unknown>);
    expect(frames.some((f) => f.is_final === false && f.content === "second answer")).toBe(true);
    expect(frames.some((f) => f.is_final === true)).toBe(true);
  });
});

describe("ws protocol regression (ping/init/JWT)", () => {
  test("ping → pong", () => {
    const { ws, sent } = mockSocket();
    speech.speechWsHandlers.open(ws);
    speech.speechWsHandlers.message(ws, JSON.stringify({ type: "ping" }));
    expect(sent).toEqual([JSON.stringify({ type: "pong" })]);
  });

  test("init consumes the latest registration and binds the conversation", () => {
    speech.registerSpeechBinding("yuki-tanaka");
    const { ws } = mockSocket();
    speech.speechWsHandlers.open(ws);
    speech.speechWsHandlers.message(ws, JSON.stringify({ type: "init", conversation_id: "conv_ws_init_1" }));
    expect(speech.astronautForConversation("conv_ws_init_1")).toBe("yuki-tanaka");
  });

  test("init with no registration falls back to the default astronaut", () => {
    const { ws } = mockSocket();
    speech.speechWsHandlers.open(ws);
    speech.speechWsHandlers.message(ws, JSON.stringify({ type: "init", conversation_id: "conv_ws_init_2" }));
    expect(speech.astronautForConversation("conv_ws_init_2")).toBe(speech.DEFAULT_ASTRONAUT);
  });

  test("missing JWT → 401 missing_token; invalid JWT → 401 invalid_token (upgrade rejected)", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "seng_ws_stream_test";
    process.env.ELEVENLABS_API_KEY = TEST_API_KEY;
    expect(speech.startSpeechEngine()).toBe(true);
    const missing = await fetch("http://127.0.0.1:3392/speech/ws");
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ ok: false, error: "missing_token" });
    const bad = await fetch("http://127.0.0.1:3392/speech/ws", {
      headers: { "x-elevenlabs-speech-engine-authorization": "not-a-jwt" },
    });
    expect(bad.status).toBe(401);
    const body = (await bad.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: false, error: "invalid_token" });
    expect(JSON.stringify(body)).not.toContain(TEST_API_KEY);
  });
});
