import { afterEach, describe, expect, it } from "vitest";
import { fetchBackendLiveHealth, setLiveHealthFetch } from "./liveHealth.server";

// Loopback transport behind the `/api/health/live/:id` web proxy: every failure becomes a status
// the route maps to a small JSON code, never an exception.

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  setLiveHealthFetch(null);
  delete process.env.BACKEND_URL;
});

describe("fetchBackendLiveHealth", () => {
  it("forwards a valid payload and normalizes it", async () => {
    setLiveHealthFetch(
      (async () =>
        jsonResponse(200, {
          ok: true,
          live: true,
          updatedAt: "2026-11-16T09:41:00.000Z",
          source: "sim",
          metrics: { heart_rate_bpm: { value: 70, quality: "valid" } },
        })) as unknown as typeof fetch,
    );
    const result = await fetchBackendLiveHealth("ayla-reyes");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.payload.metrics.heart_rate_bpm?.unit).toBe("bpm");
  });

  it("maps 404 / network failure to unavailable and an abort to timeout", async () => {
    setLiveHealthFetch((async () => jsonResponse(404, { error: "not_found" })) as unknown as typeof fetch);
    expect((await fetchBackendLiveHealth("ayla-reyes")).status).toBe("unavailable");

    setLiveHealthFetch(
      (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    );
    expect((await fetchBackendLiveHealth("ayla-reyes")).status).toBe("unavailable");

    setLiveHealthFetch(
      ((_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })) as unknown as typeof fetch,
    );
    expect((await fetchBackendLiveHealth("ayla-reyes", { timeoutMs: 5 })).status).toBe("timeout");
  });
});
