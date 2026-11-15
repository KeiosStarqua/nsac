import { createFileRoute } from "@tanstack/react-router";
import { streamChatTurn } from "~/features/agent/runtime/astro-chat.server";
import { chatStreamBodySchema } from "~/features/speech/api/speechProxy.server";

// Server-Sent Events endpoint for the `/` chat (SkyChatPanel). One request per turn: the handler
// streams `data: {"type":"delta","text":"…"}` frames as the PI session produces text deltas, then
// exactly one terminal frame — `{"type":"done"}` or `{"type":"error","code":…}`. When the turn's
// `show_on_hud` tool produced a reviewed program, one `{"type":"ui","program":…}` frame precedes the
// `done`. `: ping` comments keep intermediaries from closing an idle connection (the model can take a
// few seconds to start).
// The client parses this in `features/agent/runtime/chat-transport.ts` (sse.ts codec).
//
// No key, no stack trace and no server path ever reaches this stream; the turn itself keeps every
// guarantee of `sendChatTurn` (transcript written once on success, per-astronaut queue, timeout).
// `mode: "voice"` is the Speech Engine's channel: the turn answers in spoken style (see
// `streamChatTurn`). Absent `mode` → the text path, byte-identical to before this flag existed.
// Exported from `features/speech/api/speechProxy.server.ts` so vitest can pin the shape.
const Body = chatStreamBodySchema;

const KEEPALIVE_MS = 15_000;
const SAME_SITE = new Set(["same-origin", "same-site", "none"]);

const encoder = new TextEncoder();
const frame = (payload: unknown) => encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

export const Route = createFileRoute("/api/chat-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Cheap cross-site guard: browsers always send sec-fetch-site; a missing header (curl, a
        // non-browser client) is allowed, a cross-site value is not.
        const site = request.headers.get("sec-fetch-site");
        if (site && !SAME_SITE.has(site)) {
          return new Response("forbidden", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("bad request", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
        }
        const parsed = Body.safeParse(payload);
        if (!parsed.success) {
          return new Response("bad request", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
        }

        const turnAbort = new AbortController();
        let closed = false;
        let sentDelta = false;
        let keepalive: ReturnType<typeof setInterval> | null = null;

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const write = (chunk: Uint8Array) => {
              if (closed) return false;
              try {
                controller.enqueue(chunk);
                return true;
              } catch {
                closed = true;
                return false;
              }
            };
            const writeFrame = (body: unknown) => write(frame(body));

            keepalive = setInterval(() => {
              if (closed) return;
              write(encoder.encode(": ping\n\n"));
            }, KEEPALIVE_MS);

            void (async () => {
              try {
                const result = await streamChatTurn(parsed.data.astronautId, parsed.data.message, {
                  onDelta: (text) => {
                    if (text.length === 0) return;
                    if (writeFrame({ type: "delta", text })) sentDelta = true;
                  },
                  // The `show_on_hud` result: one frame carrying only the validated program.
                  onUiProgram: (program) => {
                    writeFrame({ type: "ui", program });
                  },
                  signal: turnAbort.signal,
                  mode: parsed.data.mode,
                });
                if (result.status === "ok") {
                  // No delta ever arrived (pi.server recovered the text from the final message):
                  // send it whole so a successful turn is never an empty bubble.
                  if (!sentDelta && result.reply) writeFrame({ type: "delta", text: result.reply });
                  writeFrame({ type: "done" });
                } else {
                  writeFrame({ type: "error", code: result.status });
                }
              } catch {
                // streamChatTurn never throws by contract; this is belt and braces.
                writeFrame({ type: "error", code: "unavailable" });
              } finally {
                if (keepalive) clearInterval(keepalive);
                keepalive = null;
                if (!closed) {
                  closed = true;
                  try {
                    controller.close();
                  } catch {
                    // already closed by the runtime
                  }
                }
              }
            })();
          },
          cancel() {
            // The browser went away: stop generation and let the queued turn unwind (dispose the
            // cached session, write no assistant transcript, publish ok=false).
            closed = true;
            if (keepalive) clearInterval(keepalive);
            keepalive = null;
            turnAbort.abort();
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-store",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});
