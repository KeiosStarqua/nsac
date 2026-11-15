import { useEffect, useState } from "react";
import { fetchLiveHealth } from "../api/liveHealth";
import {
  LIVE_HEALTH_INITIAL,
  markLiveFailure,
  mergeLivePayload,
  type LiveHealthState,
} from "./liveHealth";

/** Five seconds — a vitals strip, not a 1 Hz oscilloscope. */
export const LIVE_POLL_MS = 5_000;

/**
 * Poll the live health feed for one crew member, client-only.
 *
 * - SSR renders the initial state (`data: null, settled: false`) and the strip stays hidden.
 * - One request per 5 s, chained after the previous one settles (no overlapping polls); the
 *   in-flight request is aborted before the next one, on astronaut change and on unmount.
 * - The poll pauses while the tab is hidden (`document.visibilityState`) and resumes with an
 *   immediate read when the tab becomes visible again.
 * - A failed poll keeps the last good payload (`stale: true`) instead of blanking the strip.
 */
export function useLiveHealth(astronautId: string | null | undefined): LiveHealthState {
  const [state, setState] = useState<LiveHealthState>(LIVE_HEALTH_INITIAL);
  const id = astronautId?.trim() || null;

  useEffect(() => {
    if (!id) {
      setState(LIVE_HEALTH_INITIAL);
      return;
    }

    let alive = true;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inflight: AbortController | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      clearTimer();
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      timer = setTimeout(() => {
        void run();
      }, LIVE_POLL_MS);
    };

    const run = async () => {
      clearTimer();
      inflight?.abort();
      const controller = new AbortController();
      inflight = controller;
      const payload = await fetchLiveHealth(id, { signal: controller.signal });
      if (!alive || stopped || controller.signal.aborted) return;
      inflight = null;
      setState((previous) => (payload ? mergeLivePayload(previous, payload) : markLiveFailure(previous)));
      schedule();
    };

    const onVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden") {
        clearTimer();
        inflight?.abort();
        inflight = null;
        return;
      }
      void run();
    };

    setState(LIVE_HEALTH_INITIAL);
    void run();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      alive = false;
      stopped = true;
      clearTimer();
      inflight?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [id]);

  return state;
}
