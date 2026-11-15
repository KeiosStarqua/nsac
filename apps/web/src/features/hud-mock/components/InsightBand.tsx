import { Sparkles } from "lucide-react";
import { INSIGHT_BAND, INSIGHT_CHEVRON, INSIGHT_ICON, INSIGHT_KICKER, INSIGHT_TEXT } from "../mock-classes";

export interface InsightBandProps {
  readonly text: string;
  readonly kicker: string;
  readonly ariaLabel: string;
  /** Opens `/performance` (the host passes its router navigation). */
  readonly onOpen: () => void;
}

/**
 * Bottom insight band under the centre column: one deterministic sentence derived from the same
 * fixture as the panels, plus the chevron that opens SKY / Human Performance. No LLM, no cohort data.
 */
export function InsightBand({ text, kicker, ariaLabel, onOpen }: InsightBandProps) {
  return (
    <button
      type="button"
      className={INSIGHT_BAND}
      aria-label={ariaLabel}
      onClick={onOpen}
      data-testid="mock-insight"
    >
      <Sparkles className={INSIGHT_ICON} aria-hidden="true" />
      <span className="flex min-w-0 flex-col text-left">
        <span className={INSIGHT_TEXT}>{text}</span>
        <span className={INSIGHT_KICKER}>{kicker}</span>
      </span>
      <span className={INSIGHT_CHEVRON} aria-hidden="true">
        ›
      </span>
    </button>
  );
}
