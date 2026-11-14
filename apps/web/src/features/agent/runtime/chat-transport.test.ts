import { describe, expect, it } from "vitest";
import type { UIMessageChunk } from "ai";
import { SkyChatError, SkyChatTransport, chatErrorCode, lastUserText, messageText, toUIMessages } from "./chat-transport";
import type { SkyUIMessage } from "./chat-transport";

function user(id: string, text: string): SkyUIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistant(id: string, text: string): SkyUIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

const encoder = new TextEncoder();

async function readAll(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const reader = stream.getReader();
  const chunks: UIMessageChunk[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return chunks;
}

const frame = (body: unknown) => `data: ${JSON.stringify(body)}\n\n`;

/** A response whose body streams the scripted chunks, in order, then closes. */
function sseResponse(chunks: (string | Uint8Array)[], init?: ResponseInit): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      controller.close();
    },
  });
  return new Response(body, init);
}

function transport(options: { response: Response | (() => Response); astronautId?: string | null }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return typeof options.response === "function" ? options.response() : options.response;
  }) as unknown as typeof fetch;
  const astronautId = options.astronautId === undefined ? "ayla-reyes" : options.astronautId;
  return { transport: new SkyChatTransport({ astronautId, fetchImpl }), calls };
}

/** The wire text of a whole turn: two deltas, one keepalive, then done. */
const HAPPY_WIRE = `: ping\n\ndata: ${JSON.stringify({ type: "delta", text: "Stable. " })}\n\ndata: ${JSON.stringify({ type: "delta", text: "Keep the dose." })}\n\ndata: {"type":"done"}\n\n`;

describe("sky chat transport (SSE)", () => {
  it("streams the reply as an ordered text part", async () => {
    const { transport: t, calls } = transport({ response: sseResponse([HAPPY_WIRE]) });
    const chunks = await readAll(await t.sendMessages({ messages: [user("u1", "How am I?")] }));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/chat-stream");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ astronautId: "ayla-reyes", message: "How am I?" });
    expect(chunks).toEqual([
      { type: "text-start", id: "sky-reply" },
      { type: "text-delta", id: "sky-reply", delta: "Stable. " },
      { type: "text-delta", id: "sky-reply", delta: "Keep the dose." },
      { type: "text-end", id: "sky-reply" },
      { type: "finish" },
    ]);
  });

  it("reassembles frames split at arbitrary byte boundaries", async () => {
    const bytes = encoder.encode(HAPPY_WIRE);
    // Cut inside the first delta's JSON payload and again between frames.
    const cuts = [29, 41, 57, 88];
    const chunks: Uint8Array[] = [];
    let from = 0;
    for (const cut of cuts) {
      chunks.push(bytes.slice(from, cut));
      from = cut;
    }
    chunks.push(bytes.slice(from));

    const { transport: t } = transport({ response: sseResponse(chunks) });
    const out = await readAll(await t.sendMessages({ messages: [user("u1", "hi")] }));
    expect(out.map((chunk) => chunk.type)).toEqual([
      "text-start",
      "text-delta",
      "text-delta",
      "text-end",
      "finish",
    ]);
    const text = out
      .filter((chunk) => chunk.type === "text-delta")
      .map((chunk) => (chunk as { delta: string }).delta)
      .join("");
    expect(text).toBe("Stable. Keep the dose.");
  });

  it("handles several frames in one chunk, CRLF and interleaved keepalives", async () => {
    const wire =
      ': ping\r\n\r\ndata: {"type":"delta","text":"one"}\r\n\r\ndata: {"type":"delta","text":"two"}\r\n\r\n: ping\r\n\r\ndata: {"type":"done"}\r\n\r\n';
    const { transport: t } = transport({ response: sseResponse([wire]) });
    const out = await readAll(await t.sendMessages({ messages: [user("u1", "hi")] }));
    expect(out).toEqual([
      { type: "text-start", id: "sky-reply" },
      { type: "text-delta", id: "sky-reply", delta: "one" },
      { type: "text-delta", id: "sky-reply", delta: "two" },
      { type: "text-end", id: "sky-reply" },
      { type: "finish" },
    ]);
  });

  it.each(["missing_key", "timeout", "unavailable"] as const)(
    "rejects with %s when the error frame arrives before any text",
    async (code) => {
      const { transport: t } = transport({ response: sseResponse([": ping\n\n", frame({ type: "error", code })]) });
      const error = await t.sendMessages({ messages: [user("u1", "hi")] }).catch((thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(SkyChatError);
      expect(chatErrorCode(error)).toBe(code);
    },
  );

  it("keeps the partial text and emits an error chunk (no finish) when the turn fails mid-stream", async () => {
    const { transport: t } = transport({
      response: sseResponse([frame({ type: "delta", text: "Stable. " }), frame({ type: "error", code: "timeout" })]),
    });
    const out = await readAll(await t.sendMessages({ messages: [user("u1", "hi")] }));

    expect(out.map((chunk) => chunk.type)).toEqual(["text-start", "text-delta", "error"]);
    expect(out.some((chunk) => chunk.type === "finish")).toBe(false);
    const errorChunk = out.find((chunk) => chunk.type === "error") as { errorText: string };
    // The AI SDK turns this chunk into `new Error(errorText)`, which `chatErrorCode` maps back.
    expect(chatErrorCode(new Error(errorChunk.errorText))).toBe("timeout");
  });

  it("treats a body that ends without a terminal frame as a mid-stream failure", async () => {
    const { transport: t } = transport({ response: sseResponse([frame({ type: "delta", text: "half" })]) });
    const out = await readAll(await t.sendMessages({ messages: [user("u1", "hi")] }));
    expect(out.map((chunk) => chunk.type)).toEqual(["text-start", "text-delta", "error"]);
  });

  it("reads a done frame with no text as unavailable (no empty bubble)", async () => {
    const { transport: t } = transport({ response: sseResponse([frame({ type: "done" })]) });
    const error = await t.sendMessages({ messages: [user("u1", "hi")] }).catch((thrown: unknown) => thrown);
    expect(chatErrorCode(error)).toBe("unavailable");
  });

  it("maps a non-2xx response to the code in its body, else unavailable", async () => {
    const coded = transport({
      response: new Response(JSON.stringify({ code: "missing_key" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    });
    expect(chatErrorCode(await coded.transport.sendMessages({ messages: [user("u1", "hi")] }).catch((e) => e))).toBe(
      "missing_key",
    );

    const plain = transport({ response: new Response("boom", { status: 500 }) });
    expect(chatErrorCode(await plain.transport.sendMessages({ messages: [user("u1", "hi")] }).catch((e) => e))).toBe(
      "unavailable",
    );
  });

  it("refuses without a selected astronaut or a message, without calling the server", async () => {
    const noAstronaut = transport({ response: sseResponse([HAPPY_WIRE]), astronautId: null });
    await expect(noAstronaut.transport.sendMessages({ messages: [user("u1", "hi")] })).rejects.toBeInstanceOf(SkyChatError);
    expect(noAstronaut.calls).toHaveLength(0);

    const noMessage = transport({ response: sseResponse([HAPPY_WIRE]) });
    await expect(noMessage.transport.sendMessages({ messages: [assistant("a1", "hello")] })).rejects.toBeInstanceOf(
      SkyChatError,
    );
    expect(noMessage.calls).toHaveLength(0);

    const emptyMessage = transport({ response: sseResponse([HAPPY_WIRE]) });
    await expect(emptyMessage.transport.sendMessages({ messages: [user("u1", "   ")] })).rejects.toBeInstanceOf(
      SkyChatError,
    );
    expect(emptyMessage.calls).toHaveLength(0);
  });

  it("sends the last person turn, not the last message", async () => {
    const { transport: t, calls } = transport({ response: sseResponse([HAPPY_WIRE]) });
    await readAll(
      await t.sendMessages({ messages: [user("u1", "first"), assistant("a1", "reply"), user("u2", "second")] }),
    );
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ astronautId: "ayla-reyes", message: "second" });
  });

  it("has no resumable stream", async () => {
    const { transport: t } = transport({ response: sseResponse([HAPPY_WIRE]) });
    await expect(t.reconnectToStream()).resolves.toBeNull();
  });

  it("hands a ui frame that arrives before the first delta to onUiProgram and still streams the text", async () => {
    const programs: string[] = [];
    const seen: { url: string }[] = [];
    const fetchImpl = (async (url: string) => {
      seen.push({ url });
      return sseResponse([
        frame({ type: "ui", program: "root = Surface([footer])" }),
        frame({ type: "delta", text: "Stable. " }),
        frame({ type: "delta", text: "Keep the dose." }),
        frame({ type: "done" }),
      ]);
    }) as unknown as typeof fetch;

    const t = new SkyChatTransport({ astronautId: "ayla-reyes", fetchImpl, onUiProgram: (p) => programs.push(p) });
    const out = await readAll(await t.sendMessages({ messages: [user("u1", "Show my heart rate")] }));

    expect(seen).toHaveLength(1);
    expect(programs).toEqual(["root = Surface([footer])"]);
    expect(out).toEqual([
      { type: "text-start", id: "sky-reply" },
      { type: "text-delta", id: "sky-reply", delta: "Stable. " },
      { type: "text-delta", id: "sky-reply", delta: "Keep the dose." },
      { type: "text-end", id: "sky-reply" },
      { type: "finish" },
    ]);
  });

  it("hands a ui frame that arrives mid-stream to onUiProgram without emitting a chunk", async () => {
    const programs: string[] = [];
    const fetchImpl = (async () =>
      sseResponse([
        frame({ type: "delta", text: "Stable. " }),
        frame({ type: "ui", program: "root = Surface([footer])" }),
        frame({ type: "delta", text: "Keep the dose." }),
        frame({ type: "done" }),
      ])) as unknown as typeof fetch;

    const t = new SkyChatTransport({ astronautId: "ayla-reyes", fetchImpl, onUiProgram: (p) => programs.push(p) });
    const out = await readAll(await t.sendMessages({ messages: [user("u1", "hi")] }));

    expect(programs).toEqual(["root = Surface([footer])"]);
    expect(out).toEqual([
      { type: "text-start", id: "sky-reply" },
      { type: "text-delta", id: "sky-reply", delta: "Stable. " },
      { type: "text-delta", id: "sky-reply", delta: "Keep the dose." },
      { type: "text-end", id: "sky-reply" },
      { type: "finish" },
    ]);
  });

  it("ignores a ui frame when no onUiProgram was supplied", async () => {
    const { transport: t } = transport({
      response: sseResponse([frame({ type: "ui", program: "root = Surface([footer])" }), frame({ type: "delta", text: "hi" }), frame({ type: "done" })]),
    });
    const out = await readAll(await t.sendMessages({ messages: [user("u1", "hi")] }));
    expect(out.map((chunk) => chunk.type)).toEqual(["text-start", "text-delta", "text-end", "finish"]);
  });

  it("unknown errors read as unavailable", () => {
    expect(chatErrorCode(new Error("boom"))).toBe("unavailable");
    expect(chatErrorCode(undefined)).toBe("unavailable");
  });
});

describe("sky chat history mapping", () => {
  it("maps the stored transcript to one text part per message", () => {
    const messages = toUIMessages([
      { role: "user", text: "How am I?", at: "2026-11-15T00:00:00.000Z" },
      { role: "assistant", text: "**Stable.**", at: "2026-11-15T00:00:05.000Z" },
    ]);

    expect(messages).toEqual([
      { id: "history-0", role: "user", parts: [{ type: "text", text: "How am I?" }] },
      { id: "history-1", role: "assistant", parts: [{ type: "text", text: "**Stable.**" }] },
    ]);
    expect(messageText(messages[1]!)).toBe("**Stable.**");
    expect(lastUserText(messages)).toBe("How am I?");
  });

  it("keeps ids stable for the same transcript", () => {
    const history = [{ role: "user" as const, text: "hi" }];
    expect(toUIMessages(history).map((message) => message.id)).toEqual(toUIMessages(history).map((m) => m.id));
  });

  it("has no user text when the transcript has no person turn", () => {
    expect(lastUserText(toUIMessages([{ role: "assistant", text: "hello" }]))).toBeNull();
  });
});
