import { useCallback, useEffect, useRef, useState } from "react";
import type { VoicePhase } from "./types";

/**
 * User-controlled microphone session ported from the demo: audio is analysed locally and never leaves
 * the machine. Permission is requested only on an explicit toggle; denial degrades to `error` and the
 * UI offers typed input. `energyRef` is a mutable envelope the canvas/waveform components read per
 * frame (no React re-render per animation frame).
 */
export function useSkyVoice(onPhase?: (phase: VoicePhase) => void) {
  const [phase, setPhaseState] = useState<VoicePhase>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const samplesRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const energyRef = useRef(0);
  const pendingRef = useRef(false);

  const emitPhase = useCallback(
    (next: VoicePhase) => {
      setPhaseState(next);
      onPhase?.(next);
    },
    [onPhase],
  );

  const stop = useCallback(
    async (reset = true) => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      analyserRef.current = null;
      samplesRef.current = null;
      energyRef.current = 0;
      const ctx = contextRef.current;
      contextRef.current = null;
      if (ctx) await ctx.close().catch(() => undefined);
      if (reset) emitPhase("idle");
    },
    [emitPhase],
  );

  const toggle = useCallback(async () => {
    if (pendingRef.current) return;
    if (phase === "listening" || phase === "requesting_permission") {
      await stop();
      return;
    }
    pendingRef.current = true;
    emitPhase("requesting_permission");
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone API unavailable. Use localhost or HTTPS and a supported browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error("Web Audio not supported.");
      const context = new Ctor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      const samples = new Uint8Array(analyser.fftSize);
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      streamRef.current = stream;
      contextRef.current = context;
      analyserRef.current = analyser;
      samplesRef.current = samples;
      const track = stream.getAudioTracks()[0];
      if (track) track.onended = () => void stop();
      emitPhase("listening");
    } catch {
      await stop(false);
      emitPhase("error");
    } finally {
      pendingRef.current = false;
    }
  }, [phase, emitPhase, stop]);

  /** RMS → smoothed 0..1 envelope written into energyRef; returned for the rAF loop. */
  const readEnergy = useCallback(() => {
    const analyser = analyserRef.current;
    const samples = samplesRef.current;
    if (!analyser || !samples) {
      energyRef.current *= 0.92;
      return 0;
    }
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]!; const n = (sample - 128) / 128;
      sum += n * n;
    }
    const rms = Math.sqrt(sum / samples.length);
    energyRef.current += (Math.min(rms * 6, 1) - energyRef.current) * 0.24;
    return energyRef.current;
  }, []);

  useEffect(() => () => void stop(), [stop]);

  return { phase, energyRef, toggle, readEnergy, stop };
}
