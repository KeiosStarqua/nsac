/**
 * Custom AI SDK transport for Sky's text chat — token-by-token over SSE.
 *
 * `useChat` (in `features/sky-hud/components/SkyChatPanel.tsx`) drives this class; the class POSTs to
 * the TanStack Start server route `/api/chat-stream`, which streams the PI session's text deltas as
 * `data: {"type":"delta","text":"…"}` frames and ends with `data: {"type":"done"}` or
 * `data: {"type":"error","code":…}`. A turn whose `show_on_hud` tool passed catalog review also carries
 * one `data: {"type":"ui","program":"…","chatDock"?:"right"}` frame: it is handed to the constructor's
 * `onUiProgram` (the panel swaps the gen HUD's OpenUI tree; `chatDock` carries the harness's dock
 * decision) and never becomes an AI SDK chunk. The body is parsed
 * incrementally by `./sse.ts`, so frames may be split at any byte boundary and a delta reaches the UI
 * as it arrives.
 *
 * Errors keep the pre-stream semantics:
 *  - a failed HTTP response, or an `error` frame BEFORE the first delta, is thrown as
 *    {@link SkyChatError}; AI SDK v7 puts a throw from `sendMessages` on `useChat().error` and no
 *    assistant bubble is created;
 *  - an `error` frame AFTER text was already emitted becomes an AI SDK `error` chunk, so the partial
 *    answer stays on screen and the banner shows over it (no `finish`, so `onFinish` is treated as a
 *    failure and the partial text never reaches the HUD prompt).
 *
 * The module is client-safe (type-only imports from `ai`); `fetch` is injectable so the transport can
 * be unit-tested without a server.
 */
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { createSseParser } from "./sse";

export type ChatTurnStatus = "ok" | "missing_key" | "unavailable" | "timeout" | "aborted";
export type ChatErrorCode = Exclude<ChatTurnStatus, "ok">;

const ERROR_CODES: readonly ChatErrorCode[] = ["missing_key", "unavailable", "timeout", "aborted"];

/** One stored transcript line, as `loadChatHistory` returns it. */
export type ChatHistoryMessage = { role: "user" | "assistant"; text: string; at?: string };

/** The shape a turn resolves with on the server (`sendChatTurn` / `streamChatTurn`). */
export type ChatTurnResult = {
  status: ChatTurnStatus;
  reply?: string;
  messages?: ChatHistoryMessage[];
};

export type SkyUIMessage = UIMessage;

export class SkyChatError extends Error {
  readonly code: ChatErrorCode;

  constructor(code: ChatErrorCode) {
    super(code);
    this.name = "SkyChatError";
    this.code = code;
  }
}

function isErrorCode(value: unknown): value is ChatErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Maps anything `useChat().error` holds back to a banner code; unknown errors read as unavailable.
 * A code can arrive either as a `SkyChatError` (thrown before the stream) or as the message of the
 * `Error` the AI SDK builds from an `error` chunk emitted mid-stream.
 */
export function chatErrorCode(error: unknown): ChatErrorCode {
  if (error instanceof SkyChatError) return error.code;
  if (error instanceof Error && isErrorCode(error.message)) return error.message;
  const cause = (error as { cause?: unknown } | null)?.cause;
  if (cause instanceof Error && isErrorCode(cause.message)) return cause.message;
  return "unavailable";
}

export function messageText(message: SkyUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/** The text of the person's most recent turn (what the stream route receives). */
export function lastUserText(messages: SkyUIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    const text = messageText(message);
    return text.length > 0 ? text : null;
  }
  return null;
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

const STREAM_PATH = "/api/chat-stream";
const PART_ID = "sky-reply";

type Frame =
  | { type: "delta"; text: string }
  | { type: "ui"; program: string; chatDock?: "right" }
  | { type: "done" }
  | { type: "error"; code: ChatErrorCode };

function parseFrame(data: string): Frame | null {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== "object") return null;
  const frame = raw as { type?: unknown; text?: unknown; code?: unknown; program?: unknown; chatDock?: unknown };
  if (frame.type === "delta" && typeof frame.text === "string") return { type: "delta", text: frame.text };
  if (frame.type === "ui" && typeof frame.program === "string")
    return { type: "ui", program: frame.program, ...(frame.chatDock === "right" ? { chatDock: "right" as const } : {}) };
  if (frame.type === "done") return { type: "done" };
  if (frame.type === "error") return { type: "error", code: isErrorCode(frame.code) ? frame.code : "unavailable" };
  return null;
}

/** Pulls whole SSE frames out of a byte stream, keeping the unfinished tail between reads. */
function openFrames(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const queue: string[] = [];
  const parser = createSseParser((data) => queue.push(data));
  let drained = false;

  return {
    async next(): Promise<string | null> {
      for (;;) {
        const queued = queue.shift();
        if (queued !== undefined) return queued;
        if (drained) return null;
        const { done, value } = await reader.read();
        if (done) {
          drained = true;
          parser(decoder.decode());
          const rest = queue.shift();
          return rest === undefined ? null : rest;
        }
        if (value) parser(decoder.decode(value, { stream: true }));
      }
    },
    cancel() {
      drained = true;
      void reader.cancel().catch(() => {});
    },
  };
}

/**
 * Consumes the head of the response (up to the first delta or a terminal frame) and returns the
 * chunk stream. Consuming the head first is what lets an error before any text reject
 * `sendMessages`, so `useChat().error` gets a {@link SkyChatError} and the panel shows its banner
 * without an empty assistant bubble.
 */
async function openTurnStream(
  body: ReadableStream<Uint8Array>,
  onUiProgram?: (program: string, chatDock?: "right") => void,
): Promise<ReadableStream<UIMessageChunk>> {
  const frames = openFrames(body);
  let head: string | null = null;
  for (;;) {
    let raw: string | null;
    try {
      raw = await frames.next();
    } catch {
      frames.cancel();
      throw new SkyChatError("unavailable");
    }
    if (raw === null) break;
    const frame = parseFrame(raw);
    if (!frame) continue;
    if (frame.type === "ui") {
      // A HUD program is not chat content: hand it to the panel and keep looking for the first delta.
      onUiProgram?.(frame.program, frame.chatDock);
      continue;
    }
    if (frame.type === "delta") {
      head = frame.text;
      break;
    }
    frames.cancel();
    // An empty `done` means the turn produced no text: never render an empty bubble.
    throw new SkyChatError(frame.type === "error" ? frame.code : "unavailable");
  }
  if (head === null) {
    frames.cancel();
    throw new SkyChatError("unavailable");
  }
  const firstDelta = head;

  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      const emit = (chunk: UIMessageChunk) => {
        try {
          controller.enqueue(chunk);
        } catch {
          // consumer went away: the pump stops on the next read
        }
      };
      emit({ type: "text-start", id: PART_ID });
      emit({ type: "text-delta", id: PART_ID, delta: firstDelta });

      void (async () => {
        try {
          for (;;) {
            const raw = await frames.next();
            // A body that ends without a terminal frame is a failed turn mid-stream.
            if (raw === null) {
              emit({ type: "error", errorText: "unavailable" });
              break;
            }
            const frame = parseFrame(raw);
            if (!frame) continue;
            if (frame.type === "delta") {
              if (frame.text.length > 0) emit({ type: "text-delta", id: PART_ID, delta: frame.text });
            } else if (frame.type === "ui") {
              // Program frames ride alongside the text; they never become AI SDK chunks.
              onUiProgram?.(frame.program, frame.chatDock);
            } else if (frame.type === "done") {
              emit({ type: "text-end", id: PART_ID });
              emit({ type: "finish" });
              break;
            } else {
              // Mid-stream failure: keep the partial text on screen, show the banner, no finish.
              emit({ type: "error", errorText: frame.code });
              break;
            }
          }
        } catch {
          emit({ type: "error", errorText: "unavailable" });
        } finally {
          frames.cancel();
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      })();
    },
    cancel() {
      frames.cancel();
    },
  });
}

async function errorCodeFromResponse(response: Response): Promise<ChatErrorCode> {
  try {
    const body = (await response.json()) as { code?: unknown; error?: unknown };
    if (isErrorCode(body?.code)) return body.code;
    if (isErrorCode(body?.error)) return body.error;
  } catch {
    // not JSON: fall through
  }
  return "unavailable";
}

export class SkyChatTransport implements ChatTransport<SkyUIMessage> {
  private readonly astronautId: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly onUiProgram?: (program: string, chatDock?: "right") => void;

  constructor(options: {
    astronautId: string | null;
    fetchImpl?: typeof fetch;
    onUiProgram?: (program: string, chatDock?: "right") => void;
  }) {
    this.astronautId = options.astronautId;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.onUiProgram = options.onUiProgram;
  }

  async sendMessages(options: { messages: SkyUIMessage[] }): Promise<ReadableStream<UIMessageChunk>> {
    const astronautId = this.astronautId;
    if (!astronautId) throw new SkyChatError("unavailable");
    const message = lastUserText(options.messages);
    if (!message) throw new SkyChatError("unavailable");

    const response = await this.fetchImpl(STREAM_PATH, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ astronautId, message }),
    });
    if (!response.ok) throw new SkyChatError(await errorCodeFromResponse(response));
    if (!response.body) throw new SkyChatError("unavailable");
    return openTurnStream(response.body, this.onUiProgram);
  }

  /** No resumable server stream: a turn is answered in one request. */
  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
