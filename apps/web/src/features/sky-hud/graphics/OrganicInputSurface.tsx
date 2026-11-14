import { useEffect, useRef } from "react";
import type { VoicePhase } from "../domain/types";

export interface OrganicInputSurfaceProps {
  phase: VoicePhase;
  energy?: number;
  reducedMotion?: boolean;
}

const tint: Record<VoicePhase, string> = {
  idle: "rgba(108,236,255,0.18)",
  requesting_permission: "rgba(108,236,255,0.18)",
  listening: "rgba(85,231,185,0.22)",
  transcribing: "rgba(108,236,255,0.16)",
  thinking: "rgba(124,107,255,0.22)",
  speaking: "rgba(108,236,255,0.26)",
  offline: "rgba(107,127,149,0.18)",
  error: "rgba(255,154,122,0.2)",
};

export function OrganicInputSurface({ phase, energy = 0, reducedMotion = false }: OrganicInputSurfaceProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;
    const reduced = reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let t = 0;
    const draw = () => {
      const tt = reduced ? 0 : t;
      el.style.transform = `translateY(${Math.sin(tt * 0.6) * 2}px)`;
      if (!reduced) t += 0.016;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "15%",
        right: "15%",
        bottom: "4%",
        height: "14%",
        borderRadius: "50%",
        background: `radial-gradient(ellipse at 50% 40%, ${tint[phase]}, transparent 70%)`,
        boxShadow: `0 0 60px ${tint[phase]}`,
        opacity: 0.85,
        filter: "blur(2px)",
        pointerEvents: "none",
      }}
    >
      <svg viewBox="0 0 400 80" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M0 ${40 + i * 4} Q100 ${20 + i * 6} 200 ${40 + i * 3} T400 ${40 + i * 4}`}
            fill="none"
            stroke="rgba(108,236,255,0.35)"
            strokeWidth="0.8"
          />
        ))}
      </svg>
    </div>
  );
}