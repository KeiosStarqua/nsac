import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InsightBand } from "./components/InsightBand";
import {
  INSIGHT_BAND,
  INSIGHT_BAND_DISMISSED,
  INSIGHT_BAND_DOCK,
  ORB_STAGE,
  ORB_STAGE_CHAT,
  VOICE_CLUSTER,
  VOICE_CLUSTER_HIDDEN,
} from "./mock-classes";

// Chat-open layout contract of the `/` mock console: the voice zone hides, the orb shrinks and
// lifts, and the insight band slides out. Everything is transform/opacity only — no box changes —
// so the grid, greeting and footer keep their positions.

describe("hud-mock chat-open classes", () => {
  test("voice cluster hides without leaving the layout", () => {
    expect(VOICE_CLUSTER_HIDDEN).toContain("opacity-0");
    expect(VOICE_CLUSTER_HIDDEN).toContain("pointer-events-none");
    expect(VOICE_CLUSTER_HIDDEN).toContain("select-none");
    expect(VOICE_CLUSTER_HIDDEN).toContain("scale-[.92]");
    expect(VOICE_CLUSTER_HIDDEN).toContain("-translate-y-[6px]");
    // Never a layout-breaking utility: the cluster keeps its box, only transform/opacity change.
    for (const forbidden of ["hidden", "h-0", "max-h-0", "absolute"]) {
      expect(VOICE_CLUSTER_HIDDEN.split(" ")).not.toContain(forbidden);
    }
    // The resting cluster owns the transition, so both directions animate.
    expect(VOICE_CLUSTER).toContain("transition");
    expect(VOICE_CLUSTER).toContain("motion-reduce:transition-none");
  });

  test("orb stage grows a transform-only chat variant", () => {
    expect(ORB_STAGE_CHAT.startsWith(ORB_STAGE)).toBe(true);
    expect(ORB_STAGE_CHAT).toContain("-translate-y-[4%]");
    expect(ORB_STAGE_CHAT).toContain("scale-[.85]");
    expect(ORB_STAGE).toContain("motion-reduce:transition-none");
    // The chat variant adds transform utilities only — nothing that changes the stage's box.
    const added = ORB_STAGE_CHAT.slice(ORB_STAGE.length).trim().split(" ").filter(Boolean);
    expect(added).toEqual(["-translate-y-[4%]", "scale-[.85]"]);
  });

  test("insight band slides down and fades", () => {
    expect(INSIGHT_BAND_DISMISSED).toContain("opacity-0");
    expect(INSIGHT_BAND_DISMISSED).toContain("translate-y-[115%]");
    expect(INSIGHT_BAND_DISMISSED).not.toContain("-translate-y-[115%]");
    expect(INSIGHT_BAND_DISMISSED).toContain("pointer-events-none");
    expect(INSIGHT_BAND).toContain("translate_.3s_ease");
    expect(INSIGHT_BAND).toContain("opacity_.3s_ease");
    // The slide is docked in a clipping box so it never adds scrollable overflow to the column.
    expect(INSIGHT_BAND_DOCK).toContain("[overflow:clip]");
    expect(INSIGHT_BAND_DOCK).toContain("w-full");
  });

  test("dismissed insight band is inert and hidden from assistive tech", () => {
    const props = { text: "Simulated signals", kicker: "Open", ariaLabel: "Open", onOpen: () => {} };
    // Only the band button's own attributes count (the icon spans are decorative and always aria-hidden).
    const openingTag = (html: string) => html.slice(html.indexOf("<button"), html.indexOf(">", html.indexOf("<button")));

    const resting = renderToStaticMarkup(createElement(InsightBand, props));
    expect(openingTag(resting)).not.toContain("inert");
    expect(openingTag(resting)).not.toContain("aria-hidden");

    const dismissed = renderToStaticMarkup(createElement(InsightBand, { ...props, dismissed: true }));
    expect(openingTag(dismissed)).toContain("inert");
    expect(openingTag(dismissed)).toContain('aria-hidden="true"');
    expect(dismissed).toContain(INSIGHT_BAND_DISMISSED);
    // The dock is always present, so the layout box (and the column height) never changes.
    expect(resting.startsWith(`<div class="${INSIGHT_BAND_DOCK}">`)).toBe(true);
    expect(dismissed.startsWith(`<div class="${INSIGHT_BAND_DOCK}">`)).toBe(true);
  });
});
