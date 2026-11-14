import type { RefObject } from "react";
import { CrystalizedBall } from "../../shared/react-bits";
import type { VoicePhase } from "./types";

/**
 * Ambient Crystalized Ball (React Bits) for the HUD orb zone.
 * The component is cursor-reactive, not mic-reactive, so the old mic-energy
 * sampling was dropped — `energyRef` is accepted (unused) to keep the
 * SkyScreen / SkyScreenGen call sites untouched.
 */
export function SkyOrb({ phase, energyRef }: { phase: VoicePhase; energyRef: RefObject<number> }) {
  void phase;
  void energyRef;

  return (
    <CrystalizedBall
      theme="dark"
      preset="aurora"
      size={0.94}
      interactive
      hoverStrength={0.6}
      intro
      style={{ width: "100%", height: "100%" }}
    />
  );
}
