import { createFileRoute } from "@tanstack/react-router";
import { fetchBackendLiveHealth } from "~/features/live-health/api/liveHealth.server";

// Same-origin proxy for `GET /api/health/live/:astronautId`: `features/live-health` polls this
// every 5 s and the handler forwards to the loopback backend (`apps/backend`, source of the
// simulated habitat feed). The browser never learns the backend address and no upstream body or
// stack trace is echoed — a failure is one small JSON code.
//
// The file name carries the path (`health.live.$astronautId` → `/api/health/live/$astronautId`);
// the frozen backend contract is `/api/health/live/:astronautId`, so the web path mirrors it.
const SAME_SITE = new Set(["same-origin", "same-site", "none"]);
const MAX_ID_LENGTH = 64;

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function jsonError(error: string, status: number): Response {
  return Response.json({ ok: false, error }, { status, headers: { "cache-control": "no-store" } });
}

export const Route = createFileRoute("/api/health/live/$astronautId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        // Cheap cross-site guard, same rule as `/api/tts`: a missing header (curl, a non-browser
        // client) is allowed, a cross-site value is not.
        const site = request.headers.get("sec-fetch-site");
        if (site && !SAME_SITE.has(site)) return text("forbidden", 403);

        const astronautId = String(params.astronautId ?? "").trim();
        if (!astronautId || astronautId.length > MAX_ID_LENGTH) return jsonError("bad_astronaut_id", 400);

        const result = await fetchBackendLiveHealth(astronautId);
        if (result.status === "ok") {
          // Only the contract fields leave the server (the transport already dropped unknown keys).
          return Response.json(result.payload, { headers: { "cache-control": "no-store" } });
        }

        // Backend unreachable / timed out / not deployed yet: answer the contract's own "no live
        // feed" envelope with a 200 instead of a 5xx. The client then renders its OFFLINE state
        // without a failed request in the browser console every 5 s, and `source: "none"` keeps the
        // distinction honest — the page still shows the bundled fixture, labelled as such. The
        // degraded reason travels in a header, never in the body.
        return Response.json(
          { ok: true, live: false, updatedAt: null, source: "none", metrics: {} },
          {
            status: 200,
            headers: {
              "cache-control": "no-store",
              "x-live-degraded": result.status,
            },
          },
        );
      },
    },
  },
});
