import { describe, expect, it } from "vitest";
import type { UIMessageChunk } from "ai";
import {
  SkyChatError,
  SkyChatTransport,
  chatErrorCode,
  lastUserText,
  messageText,
  replyChunks,
  toUIMessages,
} from "./chat-transport";
import type { ChatTurnResult, SendChatTurn, SkyUIMessage } from "./chat-transport";

function user(id: string, text: string): SkyUIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistant(id: string, text: string): SkyUIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

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

function transport(result: ChatTurnResult, astronautId: string | null = "ayla-reyes") {
  const calls: { astronautId: string; message: string }[] = [];
  const send: SendChatTurn = async (input) => {
    calls.push(input);
    return result;
  };
  return { transport: new SkyChatTransport({ astronautId, send }), calls };
}

describe("sky chat transport", () => {
  it("maps one whole reply to a text part", async () => {
    const { transport: t, calls } = transport({ status: "ok", reply: "  Stable. Keep the dose.  " });
    const chunks = await readAll(await t.sendMessages({ messages: [user("u1", "How am I?")] }));

    expect(calls).toEqual([{ astronautId: "ayla-reyes", message: "How am I?" }]);
    expect(chunks.map((chunk) => chunk.type)).toEqual(["text-start", "text-delta", "text-end", "finish"]);
    const delta = chunks.find((chunk) => chunk.type === "text-delta");
    expect(delta).toEqual({ type: "text-delta", id: "sky-reply", delta: "Stable. Keep the dose." });
  });

  it("sends the last person turn, not the last message", async () => {
    const { transport: t, calls } = transport({ status: "ok", reply: "ok" });
    await t.sendMessages({ messages: [user("u1", "first"), assistant("a1", "reply"), user("u2", "second")] });
    expect(calls[0]?.message).toBe("second");
  });

  it.each(["missing_key", "timeout", "unavailable"] as const)("throws the %s code", async (code) => {
    const { transport: t } = transport({ status: code });
    const error = await t.sendMessages({ messages: [user("u1", "hi")] }).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(SkyChatError);
    expect(chatErrorCode(error)).toBe(code);
  });

  it("reads ok with an empty reply as unavailable (no empty bubble)", async () => {
    const { transport: t } = transport({ status: "ok", reply: "   " });
    const error = await t.sendMessages({ messages: [user("u1", "hi")] }).catch((thrown: unknown) => thrown);
    expect(chatErrorCode(error)).toBe("unavailable");
  });

  it("refuses without a selected astronaut or a message", async () => {
    const noAstronaut = transport({ status: "ok", reply: "ok" }, null);
    await expect(noAstronaut.transport.sendMessages({ messages: [user("u1", "hi")] })).rejects.toBeInstanceOf(SkyChatError);
    expect(noAstronaut.calls).toHaveLength(0);

    const noMessage = transport({ status: "ok", reply: "ok" });
    await expect(noMessage.transport.sendMessages({ messages: [assistant("a1", "hello")] })).rejects.toBeInstanceOf(
      SkyChatError,
    );
    expect(noMessage.calls).toHaveLength(0);
  });

  it("has no resumable stream", async () => {
    const { transport: t } = transport({ status: "ok", reply: "ok" });
    await expect(t.reconnectToStream()).resolves.toBeNull();
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

describe("reply chunks", () => {
  it("starts and ends the same part id", () => {
    const chunks = replyChunks("hi", "p1");
    expect(chunks[0]).toEqual({ type: "text-start", id: "p1" });
    expect(chunks[2]).toEqual({ type: "text-end", id: "p1" });
    expect(chunks[3]).toEqual({ type: "finish" });
  });
});
