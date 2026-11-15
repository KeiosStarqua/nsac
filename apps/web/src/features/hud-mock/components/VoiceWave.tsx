import type { RefObject } from "react";
import { VoiceWaveform } from "~/features/sky-hud/VoiceWaveform";
import type { VoicePhase } from "~/features/sky-hud/types";
import { VOICE_WAVE, VOICE_WAVE_HIDDEN } from "../mock-classes";

export interface VoiceWaveProps {
  readonly phase: VoicePhase;
  readonly energyRef: RefObject<number>;
  /** Chat card open: the waveform fades and settles out of the pointer path. */
  readonly chatOpen?: boolean;
}

/** The voice waveform strip that sits between the greeting and the mic control. */
export function VoiceWave({ phase, energyRef, chatOpen = false }: VoiceWaveProps) {
  return (
    <VoiceWaveform
      phase={phase}
      energyRef={energyRef}
      className={chatOpen ? `${VOICE_WAVE} ${VOICE_WAVE_HIDDEN}` : VOICE_WAVE}
    />
  );
}
