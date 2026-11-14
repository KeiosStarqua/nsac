import { describe, expect, it } from "vitest";
import { WATCH_SCREENS, clampPage, pageIndexFromScroll } from "./watchScreens";

describe("WATCH_SCREENS", () => {
  it("has exactly three screens in the fixed swipe order", () => {
    expect(WATCH_SCREENS).toHaveLength(3);
    expect(WATCH_SCREENS.map((s) => s.id)).toEqual(["vitals", "wellness", "sky"]);
  });
  it("gives every screen a unique id and aria label key", () => {
    expect(new Set(WATCH_SCREENS.map((s) => s.id)).size).toBe(3);
    expect(new Set(WATCH_SCREENS.map((s) => s.ariaLabelKey)).size).toBe(3);
  });
  it("points every aria label key at a watch.* key", () => {
    for (const screen of WATCH_SCREENS) expect(screen.ariaLabelKey.startsWith("watch.screen")).toBe(true);
  });
});

describe("clampPage", () => {
  it("passes through valid indices", () => {
    expect(clampPage(0)).toBe(0);
    expect(clampPage(1)).toBe(1);
    expect(clampPage(2)).toBe(2);
  });
  it("clamps below and above the range", () => {
    expect(clampPage(-1)).toBe(0);
    expect(clampPage(-99)).toBe(0);
    expect(clampPage(3)).toBe(2);
    expect(clampPage(999)).toBe(2);
  });
  it("rounds fractional indices", () => {
    expect(clampPage(0.4)).toBe(0);
    expect(clampPage(0.5)).toBe(1);
    expect(clampPage(1.4)).toBe(1);
    expect(clampPage(1.6)).toBe(2);
  });
  it("falls back to 0 for non-finite input", () => {
    expect(clampPage(Number.NaN)).toBe(0);
    expect(clampPage(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("pageIndexFromScroll", () => {
  const W = 320;
  it("rounds to the nearest page", () => {
    expect(pageIndexFromScroll(0, W)).toBe(0);
    expect(pageIndexFromScroll(W * 0.49, W)).toBe(0);
    expect(pageIndexFromScroll(W * 0.5, W)).toBe(1);
    expect(pageIndexFromScroll(W * 1.5, W)).toBe(2);
    expect(pageIndexFromScroll(W, W)).toBe(1);
    expect(pageIndexFromScroll(W * 2, W)).toBe(2);
  });
  it("clamps beyond both ends", () => {
    expect(pageIndexFromScroll(-50, W)).toBe(0);
    expect(pageIndexFromScroll(W * 2.49, W)).toBe(2);
    expect(pageIndexFromScroll(W * 99, W)).toBe(2);
  });
  it("handles sub-page scroll offsets inside the first and last page", () => {
    expect(pageIndexFromScroll(12, W)).toBe(0);
    expect(pageIndexFromScroll(W * 2 + 12, W)).toBe(2);
  });
  it("returns 0 for an invalid page width or offset", () => {
    expect(pageIndexFromScroll(100, 0)).toBe(0);
    expect(pageIndexFromScroll(100, -1)).toBe(0);
    expect(pageIndexFromScroll(100, Number.NaN)).toBe(0);
    expect(pageIndexFromScroll(Number.NaN, W)).toBe(0);
  });
});
