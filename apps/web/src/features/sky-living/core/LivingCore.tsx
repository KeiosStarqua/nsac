import { useEffect, useRef } from "react";
import type { UxState } from "../model/scene";
import { lerp } from "./model";
import "./tokens.css";

interface Props { state: UxState; density?: "micro" | "low" | "medium" | "high"; className?: string; }

const STATE_COLOR: Record<UxState, string> = {
  presence: "#59E8F3",
  listening: "#FFBF64",
  processing: "#A4A0FF",
  attention: "#FFBF64",
  understanding: "#59E8F3",
  decision: "#A4A0FF",
  continuity: "#72F3C4",
  connection: "#59E8F3",
  emergency: "#FF6B75",
};

export function LivingCore({ state, density = "medium", className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<UxState>(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = true;
    let w = 0, h = 0, dpr = 1;
    let t = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, density === "high" ? 2 : 1.5);
      w = Math.max(1, Math.floor(rect.width * dpr));
      h = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = w; canvas.height = h;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    if (reduce || density === "micro") {
      // static glyph
      const drawStatic = () => {
        ctx.clearRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.3;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2);
        g.addColorStop(0, STATE_COLOR[stateRef.current]);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, r * 2, 0, Math.PI * 2); ctx.fill();
      };
      drawStatic();
      return () => { ro.disconnect(); };
    }

    const loop = () => {
      if (!running) return;
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const base = Math.min(w, h) * 0.25;
      const breath = 1 + Math.sin(t * 0.8) * 0.06;
      const r = base * breath;
      const color = STATE_COLOR[stateRef.current];
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
      g.addColorStop(0, color);
      g.addColorStop(0.4, color + "88");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2); ctx.fill();
      // orbiting particles
      const count = density === "low" ? 6 : density === "high" ? 24 : 12;
      for (let i = 0; i < count; i++) {
        const a = t * 0.6 + (i / count) * Math.PI * 2;
        const rr = r * 1.6;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(x, y, 2 * dpr, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [density]);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height: "100%", display: "block" }} aria-label="Living core" />;
}