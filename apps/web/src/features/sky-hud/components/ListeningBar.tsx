/**
 * ListeningBar — the wide recording pill that replaces the VoicePill orb while the microphone is
 * live (`phase === "listening" | "requesting_permission"`) on the console (`/` mock and
 * `?arch=openui` declarative HUD, `features/hud-gen/catalog.tsx` `MicButton`).
 *
 * It owns no capture: `useSkyVoice` keeps the one MediaStream, and this component only reads it —
 * `readSpectrum` fills the bars from the analyser, `energyRef` feeds the deterministic fallback used
 * when no analyser is attached yet. The timer is anchored at mount; only the stop button is
 * interactive (the bar itself is a container, not a control).
 */
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useCopy } from "~/shared/i18n";
import {
  LISTENING_BAR,
  LISTENING_DIVIDER,
  LISTENING_STOP,
  LISTENING_STOP_GLYPH,
  LISTENING_TIMER,
  LISTENING_WAVE,
  listeningBarEnterClass,
} from "../hud-classes";

const BARS = 46;
const WIDTH = 250;
const HEIGHT = 56;
const FRAME_MS = 32;

export type ListeningBarProps = {
  /** Ends the session — the same handler VoicePill's `onStop` ran at each call site. */
  onStop: () => void;
  /** Smoothed 0..1 mic envelope from `useSkyVoice` (read per frame, no re-render). */
  energyRef: RefObject<number>;
  /** `useSkyVoice().readSpectrum` — false when no analyser is attached. */
  readSpectrum: (bars: Uint8Array) => boolean;
  /** `prefers-reduced-motion` (hosts already know it): freezes the bars and skips the enter. */
  reducedMotion?: boolean;
};

/** mm:ss from listening start, capped at 99:59. */
export function formatListeningClock(ms: number): string {
  const total = Math.max(0, Math.min(Math.floor(ms / 1000), 99 * 60 + 59));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function ListeningBar({ onStop, energyRef, readSpectrum, reducedMotion = false }: ListeningBarProps) {
  const copy = useCopy();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Mount-anchored: the bar only mounts when listening begins.
  const startedAtRef = useRef<number>(Date.now());
  const [clock, setClock] = useState("0:00");
  const [entered, setEntered] = useState(false);

  // Enter: one frame hidden, then settle (240 ms). Reduced motion renders it settled immediately.
  useEffect(() => {
    if (reducedMotion) {
      setEntered(true);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  // Timer: ~4 updates per second, no rAF of its own.
  useEffect(() => {
    const tick = () => setClock(formatListeningClock(Date.now() - startedAtRef.current));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  // Waveform: thin rounded bars, cyan gradient, reacting to the analyser; a deterministic pattern
  // modulated by the energy envelope stands in when there is no analyser.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#6ff5cd");
    gradient.addColorStop(0.5, "#3ee8c4");
    gradient.addColorStop(1, "#18b7d8");

    const bars = new Uint8Array(BARS);
    const levels = new Float32Array(BARS);
    const slot = canvas.width / BARS;
    const barWidth = Math.max(1.4 * dpr, slot * 0.4);

    const paint = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = gradient;
      for (let i = 0; i < BARS; i++) {
        const level = Math.max(0, Math.min(1, levels[i]!));
        const h = Math.max(barWidth, (0.1 + 0.9 * level) * canvas.height);
        const x = i * slot + (slot - barWidth) / 2;
        ctx.beginPath();
        ctx.roundRect(x, (canvas.height - h) / 2, barWidth, h, barWidth / 2);
        ctx.fill();
      }
    };

    const fallbackLevel = (index: number, time: number, energy: number) => {
      const pulse =
        Math.abs(Math.sin(time * 2.1 + index * 0.52)) * Math.abs(Math.sin(time * 0.9 + index * 0.17));
      return pulse * (0.22 + 0.72 * energy);
    };

    if (reducedMotion) {
      for (let i = 0; i < BARS; i++) levels[i] = fallbackLevel(i, 0.7, energyRef.current);
      paint();
      return;
    }

    let raf = 0;
    let last = 0;
    let elapsed = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      const delta = last ? Math.min((now - last) / 1000, 0.06) : FRAME_MS / 1000;
      last = now;
      elapsed += delta;
      const live = readSpectrum(bars);
      const energy = energyRef.current;
      for (let i = 0; i < BARS; i++) {
        const target = live ? bars[i]! / 255 : fallbackLevel(i, elapsed, energy);
        levels[i] = (levels[i] ?? 0) + (target - (levels[i] ?? 0)) * 0.35;
      }
      paint();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [energyRef, readSpectrum, reducedMotion]);

  return (
    <div className={`${LISTENING_BAR} ${listeningBarEnterClass(entered, reducedMotion)}`}>
      <canvas ref={canvasRef} className={LISTENING_WAVE} aria-hidden="true" />
      <span className={LISTENING_TIMER} aria-hidden="true">{clock}</span>
      <span className={LISTENING_DIVIDER} aria-hidden="true" />
      <button type="button" className={LISTENING_STOP} onClick={onStop} aria-label={copy.hud.stopListening}>
        <span className={LISTENING_STOP_GLYPH} aria-hidden="true" />
      </button>
    </div>
  );
}
