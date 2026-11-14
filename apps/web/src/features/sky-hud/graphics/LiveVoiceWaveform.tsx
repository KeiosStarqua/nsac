import { useEffect, useRef } from "react";
import { smoothEnvelope, waveformPath } from "./WaveformModel";

export interface LiveVoiceWaveformProps {
  amplitude?: number;
  phase?: string;
  energy?: number;
  reducedMotion?: boolean;
}

export function LiveVoiceWaveform({ amplitude = 0, phase = "idle", energy = 0, reducedMotion = false }: LiveVoiceWaveformProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const envRef = useRef(0);
  const tRef = useRef(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = () => {
      const target = phase === "error" ? 0 : Math.max(amplitude, energy, phase === "idle" ? 0.08 : 0.2);
      envRef.current = smoothEnvelope(envRef.current, target, 0.25, 0.08);
      if (!reduced) tRef.current += 0.016;
      const p = pathRef.current;
      if (p) {
        if (phase === "error") {
          p.setAttribute("d", `M 0 23.5 L 269 23.5`);
        } else {
          p.setAttribute("d", waveformPath(269, 47, envRef.current, reduced ? 0 : tRef.current));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [amplitude, phase, energy, reducedMotion]);

  return (
    <svg width={269} height={47} viewBox="0 0 269 47" style={{ display: "block" }} role="img" aria-label="Voice waveform">
      <path ref={pathRef} d={waveformPath(269, 47, 0.08, 0)} fill="none" stroke="#6cecff" strokeWidth="1.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px #6cecff)" }} />
      {phase === "error" && (
        <text x="134.5" y="40" textAnchor="middle" fill="#ff9a7a" fontSize="10">waveform unavailable</text>
      )}
    </svg>
  );
}