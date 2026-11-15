import type { RefObject } from "react";
import VoicePill from "~/shared/react-bits/VoicePill/VoicePill";
import type { VoicePhase } from "~/features/sky-hud/types";
import { ListeningBar } from "~/features/sky-hud/components/ListeningBar";
import { TypeInsteadPill } from "~/features/sky-hud/components/TypeInsteadPill";
import {
  VOICE_CLUSTER,
  VOICE_CLUSTER_HIDDEN,
  VOICE_CONTROL,
  VOICE_HINT,
} from "../mock-classes";

/** The signal glyph that leads the voice hint (four ascending bars, decorative). */
const VOICE_SIGNAL =
  "h-[13px] w-[15px] flex-none text-[#4be6c8] [filter:drop-shadow(0_0_5px_rgba(75,230,200,.45))]";

export interface VoiceClusterProps {
  readonly phase: VoicePhase;
  /** Live hint line (`PHASE_TEXT` / Speech-Engine mode text), announced politely. */
  readonly hint: string;
  /** Accessible name of the idle mic pill. */
  readonly micLabel: string;
  /** The session is live: the wide `ListeningBar` replaces the pill (the mock uses this too). */
  readonly live: boolean;
  readonly chatOpen: boolean;
  readonly reducedMotion: boolean;
  readonly energyRef: RefObject<number>;
  readonly readSpectrum: (bars: Uint8Array) => boolean;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly typeInsteadLabel: string;
  readonly typeInsteadAria: string;
  readonly onToggleChat: () => void;
}

/**
 * The centre column's voice control: `VoicePill` while idle, the wide `ListeningBar` while a session
 * is live, the hint line under it and the "Type instead" pill. One component for `/` (Speech Engine
 * voice) and `?arch=openui` (local `useSkyVoice`) — the voice path differs, the chrome does not.
 */
export function VoiceCluster({
  phase,
  hint,
  micLabel,
  live,
  chatOpen,
  reducedMotion,
  energyRef,
  readSpectrum,
  onStart,
  onStop,
  typeInsteadLabel,
  typeInsteadAria,
  onToggleChat,
}: VoiceClusterProps) {
  return (
    <div className={VOICE_CONTROL}>
      <div
        className={chatOpen ? `${VOICE_CLUSTER} ${VOICE_CLUSTER_HIDDEN}` : VOICE_CLUSTER}
        aria-hidden={chatOpen ? true : undefined}
        inert={chatOpen ? true : undefined}
      >
        {live ? (
          <ListeningBar
            onStop={onStop}
            energyRef={energyRef}
            readSpectrum={readSpectrum}
            reducedMotion={reducedMotion}
          />
        ) : (
          <VoicePill
            size={84}
            accentColor="#5eead4"
            iconColor="#bfe6ef"
            background="#0e2233"
            className="shadow-[0_0_28px_2px_rgba(94,234,212,.22),0_0_10px_rgba(120,234,255,.25)]"
            ariaLabel={micLabel}
            onStart={onStart}
            onStop={({ reason }) => {
              // unmount/disabled are lifecycle noise from VoicePill, not a user stop —
              // honoring them would kill a Speech Engine session before it goes live.
              if (reason === "unmount" || reason === "disabled") return;
              onStop();
            }}
          />
        )}
        <div id="voiceHint" className={VOICE_HINT} aria-live="polite">
          <svg className={VOICE_SIGNAL} viewBox="0 0 16 15" fill="none" aria-hidden="true">
            <rect x="1" y="9" width="2.6" height="5" rx="1.3" fill="currentColor" />
            <rect x="5.4" y="6" width="2.6" height="8" rx="1.3" fill="currentColor" />
            <rect x="9.8" y="3" width="2.6" height="11" rx="1.3" fill="currentColor" />
            <rect x="14.2" y="1" width="1.4" height="13" rx="0.7" fill="currentColor" opacity=".55" />
          </svg>
          <span>{hint}</span>
        </div>
        <TypeInsteadPill
          label={typeInsteadLabel}
          ariaLabel={typeInsteadAria}
          pressed={chatOpen}
          onClick={onToggleChat}
        />
      </div>
    </div>
  );
}
