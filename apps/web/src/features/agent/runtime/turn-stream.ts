/**
 * The SSE body of `/api/chat-stream`, factored out of the route so it can be tested without a server.
 *
 * Contract (unchanged): `data: {"type":"delta","text":"…"}` per text delta, at most one
 * `data: {"type":"ui","program":"…","chatDock":"right"}` (the reviewed HUD program, plus the harness's
 * dock decision when `show_on_hud` passed) before the end, then exactly one
 * terminal frame — `data: {"type":"done"}` or `data: {"type":"error","code":…}`.
 *
 * Silence contract (the reason this module exists):
 *  - `: ok` is written the instant the stream is created, so bytes are on the wire before the model
 *    has produced anything. A response that writes nothing sits in the runtime's connection idle
 *    timer: `Bun.serve` (this app's server) cancels such a response stream after ~10 s of silence,
 *    which fires `cancel()` below, aborts the turn, and used to surface as the red "timeout" banner
 *    on any turn slower than that (measured: 15 s keepalive → cancelled at 12.0 s; 8 s and 5 s
 *    keepalive → survived).
 *  - `keepaliveMs` (5 s) then keeps every gap far below that idle timeout, and below any
 *    intermediary's (Cloudflare's origin limit is 100 s), for as long as the turn runs.
 *
 * Cancellation keeps one owner: `cancel()` marks the stream closed, stops the heartbeat and aborts
 * the turn's signal, so a disconnected reader stops inference (the session is disposed by
 * `runChatTurn`) instead of leaving a turn running unwatched. A heartbeat is only ever written to a
 * live controller, so it can never keep a dead client's turn alive.
 */

export type TurnStreamStatus = "ok" | "missing_key" | "unavailable" | "timeout" | "aborted";

export type TurnStreamResult = { status: TurnStreamStatus; reply?: string };

export type TurnStreamHooks = {
  onDelta: (text: string) => void;
  onUiProgram: (program: string, chatDock?: "right") => void;
  signal: AbortSignal;
};

export const TURN_STREAM_KEEPALIVE_MS = 5_000;

const encoder = new TextEncoder();
const openComment = encoder.encode(": ok\n\n");
const pingComment = encoder.encode(": ping\n\n");
const frame = (payload: unknown) => encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

export function createTurnStream(options: {
  run: (hooks: TurnStreamHooks) => Promise<TurnStreamResult>;
  keepaliveMs?: number;
}): ReadableStream<Uint8Array> {
  const keepaliveMs = options.keepaliveMs ?? TURN_STREAM_KEEPALIVE_MS;
  const turnAbort = new AbortController();
  let closed = false;
  let sentDelta = false;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stopKeepalive = () => {
    if (keepalive) clearInterval(keepalive);
    keepalive = null;
  };

  return new ReadableStream<Uint8Array>({
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

      // First bytes, before any model work: no idle window while the model thinks.
      write(openComment);
      keepalive = setInterval(() => {
        if (closed) return;
        write(pingComment);
      }, keepaliveMs);

      void (async () => {
        try {
          const result = await options.run({
            onDelta: (text) => {
              if (text.length === 0) return;
              if (writeFrame({ type: "delta", text })) sentDelta = true;
            },
            onUiProgram: (program, chatDock) => {
              writeFrame({ type: "ui", program, ...(chatDock ? { chatDock } : {}) });
            },
            signal: turnAbort.signal,
          });
          if (result.status === "ok") {
            // No delta ever arrived (pi.server recovered the text from the final message):
            // send it whole so a successful turn is never an empty bubble.
            if (!sentDelta && result.reply) writeFrame({ type: "delta", text: result.reply });
            writeFrame({ type: "done" });
          } else if (result.status === "aborted") {
            // The reader cancelled: not an error to report, and the controller is already closed.
          } else {
            writeFrame({ type: "error", code: result.status });
          }
        } catch {
          // the turn never throws by contract; this is belt and braces.
          writeFrame({ type: "error", code: "unavailable" });
        } finally {
          stopKeepalive();
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
      // The reader went away: stop generation and let the queued turn unwind (dispose the cached
      // session, write no assistant transcript, publish ok=false).
      closed = true;
      stopKeepalive();
      turnAbort.abort();
    },
  });
}
