// Watch Mode pager — pure logic for the three swipe screens.
// No React, no DOM: unit-tested in watchScreens.test.ts.

export type WatchScreenId = "vitals" | "wellness" | "sky";

export interface WatchScreen {
  readonly id: WatchScreenId;
  /** i18n key under `watch.*` used for the page region aria-label and the dot label. */
  readonly ariaLabelKey: "watch.screenVitals" | "watch.screenWellness" | "watch.screenSky";
}

/** The three screens, in swipe order. Length is contractual — the pager, dots and chevrons all derive from this list. */
export const WATCH_SCREENS: readonly WatchScreen[] = [
  { id: "vitals", ariaLabelKey: "watch.screenVitals" },
  { id: "wellness", ariaLabelKey: "watch.screenWellness" },
  { id: "sky", ariaLabelKey: "watch.screenSky" },
] as const;

/** Clamp an index into [0, WATCH_SCREENS.length - 1]; non-finite input falls back to 0. */
export function clampPage(index: number): number {
  if (!Number.isFinite(index)) return 0;
  const rounded = Math.round(index);
  return Math.min(WATCH_SCREENS.length - 1, Math.max(0, rounded));
}

/** Map a scroll offset to the nearest page index (round + clamp). A zero or invalid page width reads as page 0. */
export function pageIndexFromScroll(scrollLeft: number, pageWidth: number): number {
  if (!Number.isFinite(scrollLeft) || !Number.isFinite(pageWidth) || pageWidth <= 0) return 0;
  return clampPage(scrollLeft / pageWidth);
}
