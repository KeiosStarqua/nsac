import { useLocale } from "~/shared/i18n";
import { STRINGS } from "./strings";
import type { VoicePhase } from "../domain";

export interface VoiceHintProps {
  phase: VoicePhase;
}

const PHASE_TEXT: Record<VoicePhase, keyof typeof STRINGS.en> = {
  idle: "micIdle",
  requesting_permission: "micIdle",
  listening: "micListening",
  transcribing: "micThinking",
  thinking: "micThinking",
  speaking: "micSpeaking",
  offline: "micUnavailable",
  error: "micUnavailable",
};

export function VoiceHint({ phase }: VoiceHintProps) {
  const locale = useLocale();
  const s = STRINGS[locale];
  const key = PHASE_TEXT[phase];
  return <p style={{ fontSize: 19, color: "#ecf7ff", textAlign: "center", margin: 0 }}>{s[key]}</p>;
}