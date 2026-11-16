import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InsightBand } from "./components/InsightBand";
import {
  INSIGHT_BAND,
  INSIGHT_BAND_DISMISSED,
  INSIGHT_BAND_DOCK,
  ORB_REEL,
  ORB_REEL_CHAT,
  ORB_STAGE,
  ORB_ZONE_CHAT,
  VOICE_CLUSTER,
  VOICE_CLUSTER_HIDDEN,
} from "./mock-classes";
import { CHAT_CARD_ANCHOR, CHAT_CARD_AXIS, CHAT_CARD_HEIGHT, CHAT_CARD_TOP, ORB_BALL_SIZE, ORB_ZONE_CHAT_SIZE, ORB_ZONE_CHAT_WIDTH } from "../sky-hud/chat-geometry";

// Chat-open layout contract of the `/` mock console: the voice zone hides, the orb parks at the top
// of the centre column (leaving the chat card underneath it), and the insight band slides out.
// Everything is transform/opacity/width only — no box changes on the stage — so the grid and greeting
// keep their positions.

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

  test("orb parks at the column top without moving the stage box", () => {
    // The stage keeps its box (flex-1/min-h-0): only the reel and the zone carry the chat-open move.
    expect(ORB_STAGE).toContain("flex-1");
    expect(ORB_STAGE).toContain("min-h-0");
    // The reel is pulled up half the stage and the zone pushes itself down half of its own height, so
    // the zone's top edge lands on the stage's — percentages, so no layout reflow and it animates.
    expect(ORB_REEL_CHAT.startsWith(ORB_REEL)).toBe(true);
    expect(ORB_REEL_CHAT).toContain("min-[1101px]:-translate-y-1/2");
    expect(ORB_REEL_CHAT).toContain("min-[1101px]:h-full");
    expect(ORB_REEL_CHAT).toContain("transition");
    expect(ORB_REEL_CHAT).toContain("motion-reduce:transition-none");
    expect(ORB_ZONE_CHAT).toContain("min-[1101px]:translate-y-1/2");
    expect(ORB_ZONE_CHAT).toContain("[transition:width_.3s_ease,translate_.3s_ease]");
    // The chat ball has a fixed diameter and the zone is that / 0.72 (the vendored ball draws at 0.72).
    expect(ORB_ZONE_CHAT).toContain(ORB_ZONE_CHAT_WIDTH);
    expect(ORB_ZONE_CHAT_WIDTH).toContain(ORB_ZONE_CHAT_SIZE);
    expect(ORB_ZONE_CHAT_SIZE).toContain(ORB_BALL_SIZE);
  });

  test("chat card anchors under the ball on the centre-column axis", () => {
    // Vertical: header bottom (measured) + the zone's top pad + the ball + the 8px gap.
    expect(CHAT_CARD_TOP).toContain("var(--hud-header-bottom,96px)");
    expect(CHAT_CARD_TOP).toContain(ORB_ZONE_CHAT_SIZE);
    expect(CHAT_CARD_TOP).toContain("+8px");
    expect(CHAT_CARD_HEIGHT).toContain("min(600px,calc(100dvh-");
    // The classes Tailwind actually ships are literal copies of those two values — kept in step here.
    expect(CHAT_CARD_ANCHOR).toContain(`mt-[${CHAT_CARD_TOP}]`);
    expect(CHAT_CARD_ANCHOR).toContain(`h-[${CHAT_CARD_HEIGHT}]`);
    // Horizontal: −80px on the three-column console, +208px (clamped) on the two-column one.
    expect(CHAT_CARD_AXIS).toContain("min-[1101px]:-translate-x-[80px]");
    expect(CHAT_CARD_AXIS).toContain("min-[721px]:max-[1100px]:translate-x-[min(208px,calc(50vw-288px))]");
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
