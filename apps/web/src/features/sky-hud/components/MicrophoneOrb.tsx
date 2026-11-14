import { useLocale } from "~/shared/i18n";
import { STRINGS } from "./strings";
import type { VoicePhase } from "../domain";

export interface MicrophoneOrbProps {
  phase: VoicePhase;
  isMicActive: boolean;
  onToggle: () => void;
  onInterrupt: () => void;
}

export function MicrophoneOrb({ phase, isMicActive, onToggle }: MicrophoneOrbProps) {
  const locale = useLocale();
  const s = STRINGS[locale];
  const aria =
    phase === "listening" ? s.micAriaListening :
    phase === "thinking" || phase === "transcribing" ? s.micAriaThinking :
    phase === "speaking" ? s.micAriaSpeaking : s.micAriaIdle;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={aria}
      style={{ width: 84, height: 84, borderRadius: "50%", background: "rgba(8,27,48,0.6)", border: "1.5px solid #6cecff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 0 18px rgba(108,236,255,0.35)" }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect x="11" y="4" width="6" height="14" rx="3" fill="none" stroke="#ecf7ff" strokeWidth="1.6" />
        <path d="M7 14 a7 7 0 0 0 14 0" fill="none" stroke="#ecf7ff" strokeWidth="1.6" />
        <line x1="14" y1="21" x2="14" y2="25" stroke="#ecf7ff" strokeWidth="1.6" />
      </svg>
      {isMicActive && <span aria-hidden="true" style={{ position: "absolute", width: 10, height: 10, borderRadius: "50%", background: "#55e7b9", top: 6, right: 6 }} />}
    </button>
  );
}