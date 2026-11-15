import { configure } from "onedollarstats";

let done = false;

/** Client-only, one-shot. No-ops on SSR and when called twice. */
export function initAnalytics(): void {
  if (done || typeof window === "undefined") return;
  done = true;
  // Hidden operator pages are never tracked: /admin and every /admin/<tab> route (exact match otherwise).
  configure({ autocollect: true, excludePages: ["/admin", "/admin/*"] });
}
