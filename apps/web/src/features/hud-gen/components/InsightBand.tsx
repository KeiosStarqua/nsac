import { Sparkles } from "lucide-react";
import {
  INSIGHT_BAND,
  INSIGHT_BAND_DISMISSED,
  INSIGHT_BAND_DOCK,
  INSIGHT_CHEVRON,
  INSIGHT_ICON,
  INSIGHT_KICKER,
  INSIGHT_TEXT,
} from "../mock-classes";

export interface InsightBandProps {
  readonly text: string;
  readonly kicker: string;
  readonly ariaLabel: string;
  /** Opens `/performance` (the host passes its router navigation). */
  readonly onOpen: () => void;
  /**
   * The chat card is open: the band slides down out of the way (transform + opacity only, no
   * layout change) and is inert, so its `/performance` action cannot be focused or clicked.
   */
  readonly dismissed?: boolean;
}

/**
 * Bottom insight band under the centre column: one deterministic sentence derived from the same
 * fixture as the panels, plus the chevron that opens SKY / Human Performance. No LLM, no cohort data.
 *
 * The dock around it keeps the band's box (and the column's height) untouched while the chat card is
 * open — the band only slides and fades inside it.
 */
export function InsightBand({ text, kicker, ariaLabel, onOpen, dismissed = false }: InsightBandProps) {
  return (
    <div className={INSIGHT_BAND_DOCK}>
      <button
        type="button"
        className={dismissed ? `${INSIGHT_BAND} ${INSIGHT_BAND_DISMISSED}` : INSIGHT_BAND}
        aria-label={ariaLabel}
        aria-hidden={dismissed ? true : undefined}
        inert={dismissed ? true : undefined}
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
    </div>
  );
}
