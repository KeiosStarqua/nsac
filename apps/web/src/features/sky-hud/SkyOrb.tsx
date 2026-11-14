import type { RefObject } from "react";
import { CrystalizedBall } from "../../shared/react-bits";
import type { VoicePhase } from "./types";

/**
 * Ambient Crystalized Ball (React Bits) for the HUD orb zone.
 * The component is cursor-reactive, not mic-reactive, so the old mic-energy
 * sampling was dropped — `energyRef` is accepted (unused) to keep the
 * SkyScreen / SkyScreenGen call sites untouched. The orb zone's size comes from the
 * `.orb-zone` utilities (enlarged 2026-11-15: 26vw/355px → 34vw/465px so the
 * shader's outer halo is no longer clipped by the canvas bounds); `size` is
 * scaled by the same factor (0.94 → 0.72) to keep the ball's on-screen diameter
 * unchanged (~335px). `style` stays a required pass-through prop of the vendored
 * component (its @ts-nocheck types demand it) and matches its own 100% × 100% sizing.
 */
export function SkyOrb({ phase, energyRef }: { phase: VoicePhase; energyRef: RefObject<number> }) {
  void phase;
  void energyRef;

  return (
    <CrystalizedBall
      theme="dark"
      preset="aurora"
      size={0.72}
      interactive
      hoverStrength={0.6}
      intro
      style={{ width: "100%", height: "100%" }}
    />
  );
}
