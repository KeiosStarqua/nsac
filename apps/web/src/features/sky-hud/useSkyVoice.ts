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
  const spectrumRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const energyRef = useRef(0);
  const pendingRef = useRef(false);
  // Callers pass an inline callback (e.g. `(next) => setHint(...)`), so it changes identity on every
  // render. Holding it in a ref keeps `emitPhase`/`stop`/`toggle` stable: otherwise the unmount
  // cleanup below re-runs on the render caused by the phase change itself, stopping the stream and
  // resetting the phase to `idle` the moment a session starts.
  const onPhaseRef = useRef(onPhase);
  useEffect(() => {
    onPhaseRef.current = onPhase;
  }, [onPhase]);

  const emitPhase = useCallback((next: VoicePhase) => {
    setPhaseState(next);
    onPhaseRef.current?.(next);
  }, []);

  const stop = useCallback(
    async (reset = true) => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      analyserRef.current = null;
      samplesRef.current = null;
      spectrumRef.current = null;
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

  /**
   * Fills `bars` with the live frequency spectrum (0..255 per bar, log-spaced so the low end is not
   * crushed into one bin) and returns `true`; returns `false` when no analyser is attached, so a
   * visualiser can fall back to its own deterministic pattern. Same capture as `readEnergy` — no
   * second MediaStream, audio never leaves the machine.
   */
  const readSpectrum = useCallback((bars: Uint8Array) => {
    const analyser = analyserRef.current;
    if (!analyser) return false;
    let bins = spectrumRef.current;
    if (!bins || bins.length !== analyser.frequencyBinCount) {
      bins = new Uint8Array(analyser.frequencyBinCount);
      spectrumRef.current = bins;
    }
    analyser.getByteFrequencyData(bins);
    const n = bars.length;
    if (n === 0) return true;
    const minBin = 1;
    const maxBin = Math.max(minBin + 1, bins.length - 1);
    for (let i = 0; i < n; i++) {
      const lo = Math.floor(minBin * Math.pow(maxBin / minBin, i / n));
      const hi = Math.max(lo + 1, Math.floor(minBin * Math.pow(maxBin / minBin, (i + 1) / n)));
      let sum = 0;
      for (let j = lo; j < hi && j < bins.length; j++) sum += bins[j]!;
      bars[i] = Math.round(sum / (hi - lo));
    }
    return true;
  }, []);

  useEffect(() => () => void stop(), [stop]);

  return { phase, energyRef, toggle, readEnergy, readSpectrum, stop };
}
