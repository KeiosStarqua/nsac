/**
 * Global ⌘K / Ctrl+K shortcut for the `/` console: toggles the chat card from anywhere on the page.
 * Capture phase so a focused textarea cannot swallow it; `preventDefault` stops the browser's own
 * find/search binding; key repeat is ignored so holding the chord does not flicker the card.
 *
 * The listener only exists while `enabled` — the declarative screen turns it off on its ≤480px
 * watch layout, and `/watch` (WatchScreen) never wires it.
 */
import { useEffect, useRef } from "react";

export function useToggleChatShortcut(onToggle: () => void, enabled = true) {
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [enabled]);
}
