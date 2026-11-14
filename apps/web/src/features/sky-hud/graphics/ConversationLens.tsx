import { useEffect, useRef } from "react";

export interface ConversationLensProps {
  energy?: number;
  reducedMotion?: boolean;
}

export function ConversationLens({ energy = 0, reducedMotion = false }: ConversationLensProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;
    const reduced = reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let t = 0;
    const tick = () => {
      const op = 0.18 + energy * 0.12;
      const scale = 1 + (reduced ? 0 : Math.sin(t * 0.5) * 0.01);
      el.style.opacity = String(op);
      el.style.transform = `scale(${scale})`;
      if (!reduced) t += 0.016;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [energy, reducedMotion]);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "24%",
        right: "24%",
        top: "30%",
        height: "33%",
        borderRadius: "50%",
        background: "radial-gradient(ellipse at 50% 50%, rgba(124,107,255,0.25), rgba(75,184,255,0.08) 40%, transparent 70%)",
        filter: "blur(18px)",
        pointerEvents: "none",
        mixBlendMode: "screen",
      }}
    />
  );
}