import { useEffect, useRef } from "react";
import type { VoicePhase } from "./types";

const WIDTH = 310;
const CENTER = 35;

/** Builds the wave path for a phase. Pure function — see wave.test.ts. */
export function makeWave(time: number, loudness: number, phase: VoicePhase): string {
  const n = 150;
  const amp = phase === "listening" ? Math.min(loudness * 47, 28) : phase === "thinking" || phase === "transcribing" ? 13 : 10;
  let str = "";
  for (let i = 0; i <= n; i++) {
    const x = (i * WIDTH) / n;
    const dist = Math.abs(x - WIDTH / 2) / (WIDTH / 2);
    const envelope = Math.exp(-Math.pow(dist * 5.2, 2));
    const pulse = Math.sin((x - WIDTH / 2) / 12 - time * 3.5) * Math.cos((x - WIDTH / 2) / 19 + time * 1.1);
    const rest = Math.sin((x - WIDTH / 2) * 0.16 - time * 1.7) * Math.exp(-Math.pow((x - WIDTH / 2) / 30, 2));
    const y = CENTER - (phase === "listening" ? pulse * amp * envelope : rest * amp * 1.2);
    str += (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1) + " ";
  }
  return str;
}

/**
 * The thin cyan waveform. Passive mirror of the voice session: flat line with one central pulse at
 * rest, reactive arc while the user is speaking. Driven by `energy`, never fakes the mic being live.
 */
export function VoiceWaveform({ phase, energyRef, reducedMotion }: { phase: VoicePhase; energyRef: React.MutableRefObject<number>; reducedMotion?: boolean }) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const glowRef = useRef<SVGPathElement | null>(null);
  const stateRef = useRef({ phase });
  stateRef.current = { phase };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = reducedMotion ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return;
      const delta = last ? Math.min((now - last) / 1000, 0.06) : 0.033;
      last = now;
      elapsed += delta;
      const { phase: p } = stateRef.current;
      const live = p === "listening" || p === "speaking" ? energyRef.current : 0.08;
      const d = makeWave(elapsed, live, p);
      pathRef.current?.setAttribute("d", d);
      glowRef.current?.setAttribute("d", d);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const staticPath = makeWave(0.6, 0.08, "idle");

  return (
    <svg className="voice-waveform" viewBox="0 0 310 70" aria-hidden="true">
      <defs>
        <linearGradient id="waveColor">
          <stop stopColor="#4d9afa" stopOpacity="0" />
          <stop offset=".23" stopColor="#65c5ff" />
          <stop offset=".5" stopColor="#9bffff" />
          <stop offset=".8" stopColor="#64e5f8" />
          <stop offset="1" stopColor="#64e5f8" stopOpacity="0" />
        </linearGradient>
        <filter id="waveGlow"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <path ref={glowRef} stroke="url(#waveColor)" strokeWidth="5" fill="none" filter="url(#waveGlow)" d={staticPath} />
      <path ref={pathRef} stroke="url(#waveColor)" strokeWidth="2" fill="none" d={staticPath} />
    </svg>
  );
}
