import { configure } from "onedollarstats";

let done = false;

/** Client-only, one-shot. No-ops on SSR and when called twice. */
export function initAnalytics(): void {
  if (done || typeof window === "undefined") return;
  done = true;
  configure({ autocollect: true, excludePages: ["/admin"] });
}
