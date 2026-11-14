import { useEffect, useState, type RefObject } from "react";
import { Shdr11 } from "../../shared/orbkit";
import type { VoicePhase } from "./types";

function phaseToOrbState(phase: VoicePhase) {
  if (phase === "transcribing" || phase === "thinking") return "thinking";
  if (phase === "speaking") return "speaking";
  return "idle";
}

/**
 * State-driven Orbkit orb for the HUD. Replaces the hand-rolled WebGL OrbCanvas.
 * Mic energy is sampled into `volumes.input` only while listening/transcribing,
 * so the orb's GL context is never remounted.
 */
export function SkyOrb({ phase, energyRef }: { phase: VoicePhase; energyRef: RefObject<number> }) {
  const [inputVol, setInputVol] = useState<number | undefined>(undefined);

  useEffect(() => {
    const listening = phase === "listening" || phase === "transcribing";
    if (!listening) {
      setInputVol(undefined);
      return;
    }
    const id = window.setInterval(() => {
      setInputVol(energyRef.current);
    }, 33);
    return () => window.clearInterval(id);
  }, [phase, energyRef]);

  const volumes = inputVol === undefined ? undefined : { input: inputVol };

  return (
    <Shdr11
      size={340}
      state={phaseToOrbState(phase)}
      volumes={volumes}
      style={{ width: "100%", height: "100%" }}
    />
  );
}