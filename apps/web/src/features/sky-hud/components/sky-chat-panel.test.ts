import { describe, expect, test } from "vitest";
import {
  CHAT_CARD,
  CHAT_CARD_CHROME,
  CHAT_CARD_DOCK,
  CHAT_CARD_ENTER,
  CHAT_CARD_ENTER_DOCK,
  CHAT_CARD_OPEN,
  CHAT_CARD_OPEN_DOCK,
  CHAT_LAYER,
  CHAT_LAYER_DOCK,
} from "./SkyChatPanel";
import { CHAT_CARD_ANCHOR, CHAT_CARD_AXIS } from "../chat-geometry";

// Docked variant of the `/` chat card (gen HUD with Sky's `show_on_hud` override active): the card
// hugs the right edge full-height under the measured header instead of riding the orb axis. The
// centre path must stay byte-equivalent in behaviour — both variants spread the same chrome array.

describe("SkyChatPanel card variants", () => {
  test("dock card pins to the right edge, full height under the measured header", () => {
    expect(CHAT_CARD_DOCK).toContain("fixed");
    expect(CHAT_CARD_DOCK).toContain("top-[calc(var(--hud-header-bottom,96px)+12px)]");
    expect(CHAT_CARD_DOCK).toContain("right-0");
    expect(CHAT_CARD_DOCK).toContain("bottom-0");
    // 16px margins from 481px up; full-bleed at ≤480px (same max-[480px]:w-full reuse as the centre path).
    expect(CHAT_CARD_DOCK).toContain("min-[481px]:right-4");
    expect(CHAT_CARD_DOCK).toContain("min-[481px]:bottom-4");
    expect(CHAT_CARD_DOCK).toContain("max-[480px]:w-full");
    // Width contract: min(430px, 100vw).
    expect(CHAT_CARD_DOCK).toContain("w-[min(430px,100vw)]");
    // Height is owned by the top/bottom anchors — no fixed-height class on the dock path.
    expect(CHAT_CARD_DOCK).not.toContain("h-[min(600px,84dvh)]");
    expect(CHAT_CARD_DOCK).not.toContain("h-dvh");
    // Unanchored from the orb geometry.
    expect(CHAT_CARD_DOCK).not.toContain(CHAT_CARD_ANCHOR);
    expect(CHAT_CARD_DOCK).not.toContain(CHAT_CARD_AXIS);
  });

  test("centre path keeps its size, axis and orb anchor", () => {
    expect(CHAT_CARD).toContain("relative");
    expect(CHAT_CARD).toContain("h-[min(600px,84dvh)]");
    expect(CHAT_CARD).toContain("w-[min(560px,94vw)]");
    expect(CHAT_CARD).toContain(CHAT_CARD_AXIS);
    expect(CHAT_CARD).toContain(CHAT_CARD_ANCHOR);
    expect(CHAT_CARD).toContain("max-[480px]:h-dvh");
    expect(CHAT_CARD).toContain("max-[480px]:w-full");
    expect(CHAT_CARD).not.toContain("min-[481px]:right-4");
    expect(CHAT_CARD).not.toContain("w-[min(430px,100vw)]");
  });

  test("both variants share the chrome array verbatim", () => {
    expect(CHAT_CARD).toContain(CHAT_CARD_CHROME);
    expect(CHAT_CARD_DOCK).toContain(CHAT_CARD_CHROME);
    // Spot-check the shared chrome itself: rim, shadow, transition, ≤480px full-bleed treatment.
    expect(CHAT_CARD_CHROME).toContain("rounded-[20px]");
    expect(CHAT_CARD_CHROME).toContain("[background:linear-gradient(180deg,#0b1a34,#081427)_padding-box,linear-gradient(120deg,rgba(92,240,208,.5),rgba(179,114,255,.5))_border-box]");
    expect(CHAT_CARD_CHROME).toContain("shadow-[0_0_44px_rgba(94,240,214,.14),0_0_80px_rgba(178,112,255,.16)]");
    expect(CHAT_CARD_CHROME).toContain("[transition:opacity_.18s_ease-out,translate_.18s_ease-out]");
    expect(CHAT_CARD_CHROME).toContain("motion-reduce:transition-none!");
    expect(CHAT_CARD_CHROME).toContain("max-[480px]:rounded-none!");
    expect(CHAT_CARD_CHROME).toContain("max-[480px]:border-0");
    expect(CHAT_CARD_CHROME).toContain("max-[480px]:[transition:none]");
  });

  test("layers and entrance pair split per variant, same z-index and dismiss contract", () => {
    // Both layers keep z-[40] (below the astronaut picker's z-60, above the HUD) and stay a plain
    // full-viewport catcher on the dock path — no flex centring.
    expect(CHAT_LAYER).toContain("z-[40]");
    expect(CHAT_LAYER).toContain("flex");
    expect(CHAT_LAYER_DOCK).toBe("fixed inset-0 z-[40]");
    expect(CHAT_LAYER_DOCK).not.toContain("flex");
    // Entrance: centre rises on y, dock slides in from the right on x; motion-reduce skips both.
    expect(CHAT_CARD_OPEN).toContain("translate-y-0");
    expect(CHAT_CARD_ENTER).toContain("translate-y-2");
    expect(CHAT_CARD_ENTER).toContain("motion-reduce:translate-y-0");
    expect(CHAT_CARD_OPEN_DOCK).toContain("translate-x-0");
    expect(CHAT_CARD_ENTER_DOCK).toContain("translate-x-3");
    expect(CHAT_CARD_ENTER_DOCK).toContain("motion-reduce:translate-x-0");
    expect(CHAT_CARD_ENTER_DOCK).toContain("motion-reduce:opacity-100");
  });
});
