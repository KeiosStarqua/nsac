// Maps the six /admin operator tabs to their routes. Pure data + helpers — no IO, no React —
// so vitest can cover the contract. Icons are referenced as values (not JSX) to stay in a .ts
// file; the layout renders them with `aria-hidden` and `size-5` (same as before the split).
import { Bot, KeyRound, Mic, RotateCcw, Sparkles, Volume2, type LucideIcon } from "lucide-react";

export type AdminTabId = "models" | "opencode" | "elevenlabs" | "speech" | "claims" | "background";
export type AdminTabRoute =
  | "/admin/models"
  | "/admin/opencode"
  | "/admin/elevenlabs"
  | "/admin/speech"
  | "/admin/claims"
  | "/admin/background";

export type AdminTab = {
  id: AdminTabId;
  to: AdminTabRoute;
  /** Key into `useCopy().admin` for the tab label. */
  labelKey: "tabModels" | "tabOpencode" | "tabElevenlabs" | "tabSpeech" | "tabClaims" | "tabBackground";
  icon: LucideIcon;
};

/** The six admin tabs, in display order (the beui MorphingTabs reorder is client-only and unsaved). */
export const ADMIN_TABS: ReadonlyArray<AdminTab> = [
  { id: "models", to: "/admin/models", labelKey: "tabModels", icon: Bot },
  { id: "opencode", to: "/admin/opencode", labelKey: "tabOpencode", icon: KeyRound },
  { id: "elevenlabs", to: "/admin/elevenlabs", labelKey: "tabElevenlabs", icon: Volume2 },
  { id: "speech", to: "/admin/speech", labelKey: "tabSpeech", icon: Mic },
  { id: "claims", to: "/admin/claims", labelKey: "tabClaims", icon: RotateCcw },
  { id: "background", to: "/admin/background", labelKey: "tabBackground", icon: Sparkles },
];

export const ADMIN_DEFAULT_TAB: AdminTabId = "models";
export const ADMIN_DEFAULT_ROUTE: AdminTabRoute = "/admin/models";

/** id → route lookup for the controlled MorphingTabs `onValueChange`. */
export const TAB_ROUTE: Record<AdminTabId, AdminTabRoute> = {
  models: "/admin/models",
  opencode: "/admin/opencode",
  elevenlabs: "/admin/elevenlabs",
  speech: "/admin/speech",
  claims: "/admin/claims",
  background: "/admin/background",
};

function isAdminTabId(id: string): id is AdminTabId {
  return id in TAB_ROUTE;
}

/** Resolve a tab id from the MorphingTabs `onValueChange` payload (validates untrusted strings). */
export function adminTabRoute(id: string | null): AdminTabRoute | null {
  return id && isAdminTabId(id) ? TAB_ROUTE[id] : null;
}

/** Derive the controlled tab from the location pathname. SSR-safe: pure string matching. */
export function adminTabFromPathname(pathname: string): AdminTabId {
  const clean = pathname.replace(/\/+$/, "") || "/";
  for (const tab of ADMIN_TABS) {
    if (clean === tab.to || clean.startsWith(`${tab.to}/`)) return tab.id;
  }
  return ADMIN_DEFAULT_TAB;
}
