import { useEffect, useRef } from "react";
import "./graphics.css";

export function SpaceSceneBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const stars: { x: number; y: number; r: number; phase: number }[] = [];
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (stars.length === 0) {
        for (let i = 0; i < 120; i++) {
          stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + 0.3, phase: Math.random() * Math.PI * 2 });
        }
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    let t = 0;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      // deep space gradient
      const g = ctx.createRadialGradient(w * 0.7, h * 0.8, 0, w * 0.7, h * 0.8, Math.max(w, h));
      g.addColorStop(0, "rgba(16,45,75,0.6)");
      g.addColorStop(1, "rgba(4,16,30,1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // earth crescent glow lower-right
      const eg = ctx.createRadialGradient(w * 0.82, h * 0.88, 10, w * 0.82, h * 0.88, w * 0.35);
      eg.addColorStop(0, "rgba(75,184,255,0.35)");
      eg.addColorStop(1, "rgba(75,184,255,0)");
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, w, h);
      // stars
      for (const s of stars) {
        const tw = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.8 + s.phase);
        ctx.globalAlpha = 0.3 + tw * 0.6;
        ctx.fillStyle = "#ecf7ff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduced) t += 0.016;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="sky-hud-graphics" aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
      <canvas ref={canvasRef} className="sky-hud-orb-canvas" />
      {/* astronaut silhouette SVG right side */}
      <svg viewBox="0 0 200 400" style={{ position: "absolute", right: "4%", bottom: "2%", width: "18%", height: "60%", opacity: 0.55 }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(108,236,255,0)" />
            <stop offset="1" stopColor="rgba(108,236,255,0.6)" />
          </linearGradient>
        </defs>
        <path d="M100 40 C80 40 70 60 70 85 C70 105 80 115 90 120 L90 160 C70 170 60 200 60 240 L60 320 L80 320 L80 250 L95 250 L95 380 L115 380 L115 250 L130 250 L130 320 L150 320 L150 240 C150 200 140 170 120 160 L120 120 C130 115 140 105 140 85 C140 60 130 40 100 40 Z" fill="none" stroke="url(#rim)" strokeWidth="1.5" />
      </svg>
      {/* window arcs */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(108,236,255,0.08), transparent 60%)", mixBlendMode: "screen" }} />
    </div>
  );
}