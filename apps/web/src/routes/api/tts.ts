import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Same-origin proxy for `POST /api/tts`: the `/` chat card calls this on every spoken reply to
// turn the assistant text into audio via the loopback backend (`apps/backend` → ElevenLabs).
// Deliberately NOT admin-gated: the chat calls it for every reply, and the backend stays
// loopback-only — this route only proxies the TTS call, capped at 1000 characters of text.
// No key, no upstream body and no server path ever reaches the browser; the backend applies its
// own validation and timeout.
const Body = z.object({
  text: z.string().min(1).max(1000),
});

const SAME_SITE = new Set(["same-origin", "same-site", "none"]);
// The backend caps its own upstream call at 25 s; give it headroom before declaring failure here.
const BACKEND_TIMEOUT_MS = 30_000;

function backendBase(): string {
  return (process.env.BACKEND_URL?.trim() || "http://127.0.0.1:3200").replace(/\/+$/, "");
}

export const Route = createFileRoute("/api/tts")({
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
          return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
        }
        const parsed = Body.safeParse(payload);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
        try {
          const res = await fetch(`${backendBase()}/api/tts`, {
            method: "POST",
            signal: controller.signal,
            headers: { "content-type": "application/json", accept: "audio/mpeg" },
            body: JSON.stringify({ text: parsed.data.text }),
          });
          if (!res.ok) {
            // Propagate the backend's error code with the same status — never the upstream body.
            let error = "tts_upstream";
            try {
              const json: unknown = await res.json();
              const candidate = (json as { error?: unknown })?.error;
              if (typeof candidate === "string") error = candidate;
            } catch {
              // backend answered with a non-JSON error body — keep the generic code
            }
            return Response.json({ ok: false, error }, { status: res.status });
          }
          const audio = await res.arrayBuffer();
          return new Response(audio, {
            status: 200,
            headers: {
              "content-type": "audio/mpeg",
              "cache-control": "no-store",
            },
          });
        } catch {
          if (controller.signal.aborted) {
            return Response.json({ ok: false, error: "tts_timeout" }, { status: 504 });
          }
          return Response.json({ ok: false, error: "tts_upstream" }, { status: 502 });
        } finally {
          clearTimeout(timer);
        }
      },
    },
  },
});
