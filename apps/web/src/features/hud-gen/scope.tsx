// Render-time data for the HUD display tree. Every string, fact and node the catalog shows
// comes from here or from `shared/i18n` copy — never baked into the program. Kept React-only
// (no IO) so the catalog stays thin and testable.
import { createContext, useContext } from "react";
import type { ReactNode, RefObject } from "react";
import type { Copy, Locale } from "~/shared/i18n";
import type { HudFacts } from "./model/facts";
import type { VoicePhase } from "~/features/sky-hud/types";

/** A host action fired by a catalog button, e.g. `{ type: "ToggleChat", params: {} }`. */
export interface HudAction {
  readonly type: string;
  readonly params?: Record<string, unknown>;
}

export interface HudScopeValue {
  readonly copy: Copy;
  readonly locale: Locale;
  readonly facts: HudFacts;
  /** Fixture mission label, digits included (fixture data, not program text). */
  readonly missionLabel: string;
  /** `mounted && !reducedMotion` — when true, animated text/count-up render. */
  readonly fx: boolean;
  readonly phase: VoicePhase;
  /** `PHASE_TEXT[phase]` from sky-hud/voiceCopy. */
  readonly hint: string;
  /** `MIC_ARIA[phase]` from sky-hud/voiceCopy. */
  readonly micAria: string;
  readonly captions: string;
  readonly greeting: string;
  readonly prompt: string;
  readonly chatOpen: boolean;
  readonly pickerOpen: boolean;
  readonly composeOrigin: "preset" | "agent";
  readonly composeHint: string;
  readonly composeHintDismissed: boolean;
  readonly conversationCopyRef: RefObject<HTMLDivElement | null>;
  /** The orb node (SkyOrb) — rendered by OrbCanvas in declarative order. */
  readonly orbNode: ReactNode;
  /** The waveform node (VoiceWaveform) — rendered by WaveCanvas in declarative order. */
  readonly waveNode: ReactNode;
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
