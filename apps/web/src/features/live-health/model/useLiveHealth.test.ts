import { describe, expect, it } from "vitest";
import { fetchLiveHealth, liveHealthProxyPath } from "../api/liveHealth";
import {
  LIVE_HEALTH_INITIAL,
  markLiveFailure,
  mergeLivePayload,
  type LiveHealthState,
} from "./liveHealth";
import { LIVE_POLL_MS } from "./useLiveHealth";

// The React effect itself is a thin wrapper over these seams (no DOM test environment in this
// package): the poll cadence, the same-origin path and every fallback branch are pinned here.

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const LIVE_BODY = {
  ok: true,
  live: true,
  updatedAt: "2026-11-16T09:41:00.000Z",
  source: "sim",
  metrics: { heart_rate_bpm: { value: 70, unit: "bpm", quality: "valid" } },
};

describe("live health poll cadence and path", () => {
  it("polls every 5 s (not 1 Hz) through the same-origin proxy", () => {
    expect(LIVE_POLL_MS).toBe(5_000);
    expect(liveHealthProxyPath("ayla-reyes")).toBe("/api/health/live/ayla-reyes");
    expect(liveHealthProxyPath("a b/c")).toBe("/api/health/live/a%20b%2Fc");
  });
});

describe("fetchLiveHealth with a mocked fetch", () => {
  it("returns the parsed payload on 200", async () => {
    const payload = await fetchLiveHealth("ayla-reyes", {
      fetchImpl: (async () => jsonResponse(200, LIVE_BODY)) as unknown as typeof fetch,
    });
    expect(payload?.live).toBe(true);
    expect(payload?.metrics.heart_rate_bpm?.value).toBe(70);
  });

  it("resolves null on a non-2xx proxy answer (backend offline or route missing)", async () => {
    for (const status of [404, 502, 504]) {
      const payload = await fetchLiveHealth("ayla-reyes", {
        fetchImpl: (async () => jsonResponse(status, { ok: false, error: "live_unavailable" })) as unknown as typeof fetch,
      });
      expect(payload).toBeNull();
    }
  });

  it("resolves null when the network throws, the body is not JSON or the contract fails", async () => {
    const throwing = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await fetchLiveHealth("ayla-reyes", { fetchImpl: throwing })).toBeNull();

    const notJson = (async () => new Response("<html>502</html>", { status: 200 })) as unknown as typeof fetch;
    expect(await fetchLiveHealth("ayla-reyes", { fetchImpl: notJson })).toBeNull();

    const wrongShape = (async () => jsonResponse(200, { live: "yes" })) as unknown as typeof fetch;
    const coerced = await fetchLiveHealth("ayla-reyes", { fetchImpl: wrongShape });
    expect(coerced?.metrics).toEqual({});
    expect(coerced?.live).toBe(false);
  });

  it("does not call fetch for an empty astronaut id", async () => {
    let called = 0;
    const spy = (async () => {
      called += 1;
      return jsonResponse(200, LIVE_BODY);
    }) as unknown as typeof fetch;
    expect(await fetchLiveHealth("   ", { fetchImpl: spy })).toBeNull();
    expect(called).toBe(0);
  });
});

describe("hook fallback behaviour (state fold)", () => {
  it("keeps the last good payload when a later poll fails, and resettles on the next success", async () => {
    const first = await fetchLiveHealth("ayla-reyes", {
      fetchImpl: (async () => jsonResponse(200, LIVE_BODY)) as unknown as typeof fetch,
    });
    const live: LiveHealthState = mergeLivePayload(LIVE_HEALTH_INITIAL, first!);
    expect(live.live).toBe(true);
    expect(live.settled).toBe(true);

    // Backend drops out: the fetch seam resolves null, the fold keeps the reading.
    const failed = await fetchLiveHealth("ayla-reyes", {
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    expect(failed).toBeNull();
    const stale = markLiveFailure(live);
    expect(stale.data).toBe(live.data);
    expect(stale.stale).toBe(true);
    expect(stale.live).toBe(true);

    // Backend returns: the new payload replaces the old one and clears stale.
    const second = await fetchLiveHealth("ayla-reyes", {
      fetchImpl: (async () =>
        jsonResponse(200, { ...LIVE_BODY, updatedAt: "2026-11-16T09:41:05.000Z" })) as unknown as typeof fetch,
    });
    const recovered = mergeLivePayload(stale, second!);
    expect(recovered.stale).toBe(false);
    expect(recovered.updatedAt).toBe("2026-11-16T09:41:05.000Z");
  });
});
