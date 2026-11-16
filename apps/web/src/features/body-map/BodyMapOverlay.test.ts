import { describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BodyMapOverlay } from "./BodyMapOverlay";
import { EscapeChip } from "./components/EscapeChip";

// The suite renders with react-dom/server like the other component tests in
// the repo (hud-gen, performance): no DOM in the node environment. The chip
// is hook-free on purpose, so its button can be activated directly to pin
// the "click calls onClose" contract; the SSR markup proves the page variant
// is what renders it.

describe("body-map page variant — Esc HUD chip", () => {
  test("the page variant renders the chip (kbd Esc + HUD text, Back to HUD aria-label)", () => {
    const html = renderToStaticMarkup(
      createElement(BodyMapOverlay, { open: true, variant: "page", onClose: () => {} }),
    );
    expect(html).toContain('aria-label="Back to HUD (Escape)"');
    expect(html).toContain(">Esc</kbd>");
    expect(html).toContain(">HUD</span>");
    expect(html).toContain('type="button"');
    // The surrounding page chrome is intact.
    expect(html).toContain('aria-label="Body systems"');
    expect(html).toContain("CC BY 4.0");
    expect(html).toContain('class="sr-only"');
  });

  test("the overlay variant does not render the chip (HUD modal unchanged)", () => {
    const html = renderToStaticMarkup(
      createElement(BodyMapOverlay, { open: true, variant: "overlay", onClose: () => {} }),
    );
    expect(html).not.toContain("Back to HUD");
    expect(html).toContain("Close");
  });

  test("activating the chip calls its onActivate — the same close the Escape handler calls", () => {
    const onActivate = vi.fn();
    // Hook-free component: invoking it returns its button element directly.
    const element = EscapeChip({ onActivate });
    expect(element.type).toBe("button");
    expect(element.props["aria-label"]).toBe("Back to HUD (Escape)");
    (element.props.onClick as () => void)();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  test("the chip carries the page placement (bottom-right desktop, top-right ≤900px, z-10)", () => {
    const element = EscapeChip({ onActivate: () => {} });
    const className = element.props.className as string;
    expect(className).toContain("bottom-[10px]");
    expect(className).toContain("right-[14px]");
    expect(className).toContain("z-10");
    expect(className).toContain("max-[900px]:bottom-auto");
    expect(className).toContain("max-[900px]:top-[12px]");
    expect(className).toContain("max-[900px]:right-[12px]");
  });
});
