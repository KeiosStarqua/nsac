import { useEffect, useRef } from "react";
import type { VoicePhase, PerformanceTier } from "../domain/types";
import "./graphics.css";

export interface AICoreOrbProps {
  phase: VoicePhase;
  audioEnergy: number;
  qualityTier: PerformanceTier;
  reducedMotion: boolean;
}

const phaseColor: Record<VoicePhase, { a: string; b: string; c: string }> = {
  idle: { a: "#6cecff", b: "#4bb8ff", c: "#bfadff" },
  requesting_permission: { a: "#6cecff", b: "#4bb8ff", c: "#bfadff" },
  listening: { a: "#9ff6ff", b: "#6cecff", c: "#bfadff" },
  transcribing: { a: "#8adfff", b: "#6cecff", c: "#a89bff" },
  thinking: { a: "#4bb8ff", b: "#7c6bff", c: "#bfadff" },
  speaking: { a: "#6cecff", b: "#55e7b9", c: "#bfadff" },
  offline: { a: "#6b7f95", b: "#4a5a6e", c: "#8a8fa0" },
  error: { a: "#ff9a7a", b: "#ff6b6b", c: "#bfadff" },
};

export function AICoreOrb({ phase, audioEnergy, qualityTier, reducedMotion }: AICoreOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ phase, audioEnergy, reducedMotion, qualityTier });
  stateRef.current = { phase, audioEnergy, reducedMotion, qualityTier };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cap = 1.75;
    let raf = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, cap);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    let t = 0;
    const draw = () => {
      const { phase: p, audioEnergy: e, reducedMotion: rm } = stateRef.current;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.42;
      ctx.clearRect(0, 0, w, h);
      const colors = phaseColor[p] ?? phaseColor.idle;
      const speed = p === "thinking" ? 2.2 : p === "speaking" ? 1.4 : 0.6;
      const energy = Math.max(0, Math.min(1, e));
      // outer rim fresnel
      const rim = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
      rim.addColorStop(0, "rgba(0,0,0,0)");
      rim.addColorStop(0.7, colors.a + "55");
      rim.addColorStop(1, colors.c + "aa");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      // inner core
      const core = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.15, 0, cx, cy, R * 0.7);
      core.addColorStop(0, colors.a + "cc");
      core.addColorStop(0.5, colors.b + "66");
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.7, 0, Math.PI * 2);
      ctx.fill();
      // filaments
      const nFil = 3;
      for (let i = 0; i < nFil; i++) {
        ctx.beginPath();
        const tilt = (i / nFil) * Math.PI;
        for (let k = 0; k <= 60; k++) {
          const ang = (k / 60) * Math.PI * 2 + (rm ? 0 : t * speed * 0.6 + i);
          const rx = R * (0.55 + 0.12 * Math.sin(ang * 2 + t));
          const ry = R * (0.35 + 0.08 * Math.cos(ang * 3 + t));
          const x = cx + Math.cos(ang + tilt) * rx;
          const y = cy + Math.sin(ang + tilt) * ry;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = colors.a;
        ctx.globalAlpha = 0.35 + energy * 0.4;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // warm amber highlight lower-right
      const hl = ctx.createRadialGradient(cx + R * 0.35, cy + R * 0.35, 0, cx + R * 0.35, cy + R * 0.35, R * 0.45);
      hl.addColorStop(0, "rgba(255,180,90,0.35)");
      hl.addColorStop(1, "rgba(255,180,90,0)");
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.arc(cx + R * 0.35, cy + R * 0.35, R * 0.45, 0, Math.PI * 2);
      ctx.fill();
      // pulse ring for listening
      if (p === "listening" && !rm) {
        const rr = R * (1 + 0.06 * Math.sin(t * 4) * (0.5 + energy));
        ctx.strokeStyle = colors.a;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (!rm) t += 0.016;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  if (reducedMotion) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 100 100" style={{ width: "80%", height: "80%" }}>
          <defs>
            <radialGradient id="orb" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6cecff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#04101e" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#orb)" />
        </svg>
      </div>
    );
  }
  return <canvas ref={canvasRef} className="sky-hud-orb-canvas" />;
}