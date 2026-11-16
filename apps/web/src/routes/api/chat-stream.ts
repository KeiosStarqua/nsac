import { createFileRoute } from "@tanstack/react-router";
import { streamChatTurn } from "~/features/agent/runtime/astro-chat.server";
import { createTurnStream } from "~/features/agent/runtime/turn-stream";
import { chatStreamBodySchema } from "~/features/speech/api/speechProxy.server";

// Server-Sent Events endpoint for the `/` chat (SkyChatPanel). One request per turn: the handler
// streams `data: {"type":"delta","text":"…"}` frames as the PI session produces text deltas, then
// exactly one terminal frame — `{"type":"done"}` or `{"type":"error","code":…}`. When the turn's
// `show_on_hud` tool produced a reviewed program, one `{"type":"ui","program":…}` frame precedes the
// `done`; it may carry `chatDock: "right"` (the harness's dock decision — passed through unchanged).
//
// The stream body (frames, `: ok` open comment, 5 s keepalive, cancel → abort) lives in
// `features/agent/runtime/turn-stream.ts` — that module carries the silence-budget reasoning: this
// server is Bun, whose idle connection timeout (~10 s, measured) used to cancel any turn that had not
// emitted its first token yet, and a cancelled response stream aborts the turn (the reader used to
// see that as `timeout`). The route itself stays thin: guard, parse, hand over.
//
// No key, no stack trace and no server path ever reaches this stream; the turn itself keeps every
// guarantee of `sendChatTurn` (transcript written once on success, per-astronaut queue, timeout).
// `mode: "voice"` is the Speech Engine's channel: the turn answers in spoken style (see
// `streamChatTurn`). Absent `mode` → the text path, byte-identical to before this flag existed.
const Body = chatStreamBodySchema;

const SAME_SITE = new Set(["same-origin", "same-site", "none"]);

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

        const stream = createTurnStream({
          run: (hooks) =>
            streamChatTurn(parsed.data.astronautId, parsed.data.message, {
              onDelta: hooks.onDelta,
              // The `show_on_hud` result: one frame carrying only the validated program.
              onUiProgram: hooks.onUiProgram,
              signal: hooks.signal,
              mode: parsed.data.mode,
            }),
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
