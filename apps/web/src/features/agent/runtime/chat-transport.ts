/**
 * Custom AI SDK transport for Sky's text chat.
 *
 * `useChat` (in `features/sky-hud/components/SkyChatPanel.tsx`) drives this class, and the class calls
 * the existing server function `sendChat` — no SSE endpoint, no backend change. The server answers one
 * whole reply per turn, so the transport emits that reply as a single text part and does not fake a
 * stream.
 *
 * Errors: a non-`ok` turn throws a {@link SkyChatError} carrying the server's code
 * (`missing_key` | `timeout` | `unavailable`). AI SDK v7 catches a throw from `sendMessages` and puts
 * it on `useChat().error`, which the panel maps back to the localized banner; no empty assistant
 * bubble is created. (The alternative — an `error` chunk — would surface as a generic Error with only
 * the message text, losing the code.)
 *
 * The module is client-safe (type-only imports from `ai`); the server function is injected as
 * `SendChatTurn` so the transport can be unit-tested without TanStack Start.
 */
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export type ChatTurnStatus = "ok" | "missing_key" | "unavailable" | "timeout";
export type ChatErrorCode = Exclude<ChatTurnStatus, "ok">;

/** One stored transcript line, as `loadChatHistory` returns it. */
export type ChatHistoryMessage = { role: "user" | "assistant"; text: string; at?: string };

export type ChatTurnResult = {
  status: ChatTurnStatus;
  reply?: string;
  messages?: ChatHistoryMessage[];
};

/** The `sendChat` server function, narrowed to what the transport needs. */
export type SendChatTurn = (input: { astronautId: string; message: string }) => Promise<ChatTurnResult>;

export type SkyUIMessage = UIMessage;

export class SkyChatError extends Error {
  readonly code: ChatErrorCode;

  constructor(code: ChatErrorCode) {
    super(code);
    this.name = "SkyChatError";
    this.code = code;
  }
}

/** Maps anything `useChat().error` holds back to a banner code; unknown errors read as unavailable. */
export function chatErrorCode(error: unknown): ChatErrorCode {
  return error instanceof SkyChatError ? error.code : "unavailable";
}

export function messageText(message: SkyUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/** The text of the person's most recent turn (what `sendChat` receives). */
export function lastUserText(messages: SkyUIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    const text = messageText(message);
    return text.length > 0 ? text : null;
  }
  return null;
}

/** The chunks for one whole assistant reply: text-start → text-delta → text-end → finish. */
export function replyChunks(reply: string, partId = "sky-reply"): UIMessageChunk[] {
  return [
    { type: "text-start", id: partId },
    { type: "text-delta", id: partId, delta: reply },
    { type: "text-end", id: partId },
    { type: "finish" },
  ];
}

export function replyStream(reply: string, partId = "sky-reply"): ReadableStream<UIMessageChunk> {
  const chunks = replyChunks(reply, partId);
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

/**
 * The stored transcript as UI messages. Ids are stable (`history-<index>`) so a re-hydration does not
 * re-key the list; every message carries exactly one text part.
 */
export function toUIMessages(history: ChatHistoryMessage[]): SkyUIMessage[] {
  return history.map((message, index) => ({
    id: `history-${index}`,
    role: message.role === "user" ? "user" : "assistant",
    parts: [{ type: "text", text: message.text }],
  }));
}

export class SkyChatTransport implements ChatTransport<SkyUIMessage> {
  private readonly astronautId: string | null;
  private readonly send: SendChatTurn;

  constructor(options: { astronautId: string | null; send: SendChatTurn }) {
    this.astronautId = options.astronautId;
    this.send = options.send;
  }

  async sendMessages(options: { messages: SkyUIMessage[] }): Promise<ReadableStream<UIMessageChunk>> {
    const astronautId = this.astronautId;
    if (!astronautId) throw new SkyChatError("unavailable");
    const message = lastUserText(options.messages);
    if (!message) throw new SkyChatError("unavailable");

    const result = await this.send({ astronautId, message });
    const reply = typeof result.reply === "string" ? result.reply.trim() : "";
    if (result.status !== "ok" || reply.length === 0) {
      // `ok` with an empty reply never becomes an empty bubble: it reads as unavailable.
      throw new SkyChatError(result.status === "ok" ? "unavailable" : result.status);
    }
    return replyStream(reply);
  }

  /** No resumable server stream: a turn is answered in one request. */
  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
