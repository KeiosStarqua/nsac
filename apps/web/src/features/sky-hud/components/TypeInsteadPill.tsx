/**
 * TypeInsteadPill — the "Type instead" trigger on the `/` voice control, shared by the declarative
 * HUD (`features/hud-gen/catalog.tsx` `ChatButton`) and the `/` mock console (`SkyHudMock`).
 *
 * Same glass pill + cyan→purple rim as the listening bar, dimmer, with the ⌘K / Ctrl K chip the
 * global shortcut (`useToggleChatShortcut`) listens for. macOS is detected once, after mount, so SSR
 * and hydration agree (`navigator` does not exist on the server).
 */
import { useEffect, useState } from "react";
import { MessageCircleIcon } from "lucide-react";
import { TYPE_PILL, TYPE_PILL_ICON, TYPE_PILL_KBD, TYPE_PILL_LABEL } from "../hud-classes";

export type TypeInsteadPillProps = {
  label: string;
  ariaLabel: string;
  /** `aria-pressed`: whether the chat card is open. */
  pressed: boolean;
  onClick: () => void;
};

export function TypeInsteadPill({ label, ariaLabel, pressed, onClick }: TypeInsteadPillProps) {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    const platform = typeof navigator === "undefined" ? "" : navigator.platform || "";
    setMac(/Mac|iPhone|iPad/.test(platform));
  }, []);

  return (
    <button type="button" id="textButton" className={TYPE_PILL} aria-label={ariaLabel} aria-pressed={pressed} onClick={onClick}>
      <MessageCircleIcon className={TYPE_PILL_ICON} strokeWidth={1.6} aria-hidden="true" />
      <span className={TYPE_PILL_LABEL}>{label}</span>
      <kbd className={TYPE_PILL_KBD}>{mac ? "⌘ K" : "Ctrl K"}</kbd>
    </button>
  );
}
