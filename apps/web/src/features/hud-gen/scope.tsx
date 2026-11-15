// Render-time data for the HUD display tree. Every string, fact and node the catalog shows
// comes from here or from `shared/i18n` copy — never baked into the program. Kept React-only
// (no IO) so the catalog stays thin and testable.
import { createContext, useContext } from "react";
import type { ReactNode, RefObject } from "react";
import type { Copy } from "~/shared/i18n";
import type { HudFacts } from "./model/facts";
import type { VoicePhase } from "~/features/sky-hud/types";

/** A host action fired by a catalog button, e.g. `{ type: "ToggleChat", params: {} }`. */
export interface HudAction {
  readonly type: string;
  readonly params?: Record<string, unknown>;
}

/** The followed crew member, as the profile card renders them. */
export interface HudAstronaut {
  readonly id: string;
  readonly name: string;
  readonly initial: string;
  /** Roster role string (`commander`, `flight_engineer`, …) mapped through `hudMock.roles`. */
  readonly role: string;
}

export interface HudScopeValue {
  readonly copy: Copy;
  readonly facts: HudFacts;
  /** The crew member the console is showing (the local pick, or the roster's first as fallback). */
  readonly astronaut: HudAstronaut;
  /** `mounted && !reducedMotion` — when true, animated text/count-up render. */
  readonly fx: boolean;
  readonly phase: VoicePhase;
  /** `PHASE_TEXT[phase]` from sky-hud/voiceCopy. */
  readonly hint: string;
  /** Smoothed 0..1 mic envelope — the listening bar's fallback amplitude. */
  readonly energyRef: RefObject<number>;
  /** `useSkyVoice().readSpectrum` — fills bars from the analyser, false when none is attached. */
  readonly readSpectrum: (bars: Uint8Array) => boolean;
  readonly greeting: string;
  /** The locale fallback question, or the last Sky reply. */
  readonly prompt: string;
  readonly chatOpen: boolean;
  readonly composeOrigin: "preset" | "agent";
  readonly composeHint: string;
  readonly composeHintDismissed: boolean;
  /** The orb node (SkyOrb) — rendered by OrbStage in declarative order. */
  readonly orbNode: ReactNode;
  /** Brand button: reset the view (close dialogs/chat, restore greeting and prompt). */
  readonly resetView: () => void;
  /**
   * Host action sink. Catalog buttons call this directly instead of OpenUI's `useTriggerAction`,
   * because `@openuidev/react-lang` 1.1.0 silently drops any action type registered in
   * `schema.actions` (see `catalog.tsx`) before it can reach `Renderer.Root`'s `onAction`.
   */
  readonly onAction?: (action: HudAction) => void;
}

const HudScopeContext = createContext<HudScopeValue | null>(null);

export function HudScopeProvider({ value, children }: { value: HudScopeValue; children: ReactNode }) {
  return <HudScopeContext.Provider value={value}>{children}</HudScopeContext.Provider>;
}

export function useHudScope(): HudScopeValue {
  const scope = useContext(HudScopeContext);
  if (!scope) throw new Error("useHudScope must be used inside <HudScopeProvider>");
  return scope;
}
