// Pure waveform helpers (testable). No React, no DOM.

export function calculateRms(samples: Float32Array | number[]): number {
  if (!samples || samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / samples.length);
  // normalize assuming input roughly [-1,1]; clamp 0..1
  return Math.max(0, Math.min(1, rms * 2));
}

export function smoothEnvelope(previous: number, current: number, attack: number, release: number): number {
  const prev = Number.isFinite(previous) ? previous : 0;
  const cur = Number.isFinite(current) ? current : 0;
  const a = Math.max(0, Math.min(1, attack));
  const r = Math.max(0, Math.min(1, release));
  if (cur > prev) return prev + (cur - prev) * a;
  return prev + (cur - prev) * r;
}

export function waveformPath(width: number, height: number, envelope: number, t: number): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const mid = h / 2;
  const env = Math.max(0, Math.min(1, envelope));
  const amp = env * (h * 0.42) + (env === 0 ? h * 0.06 : 0);
  const segments = 60;
  let d = `M 0 ${mid}`;
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * w;
    const phase = (i / segments) * Math.PI * 2 * 2 + t * 1.6;
    const y = mid + Math.sin(phase) * amp * (0.6 + 0.4 * Math.sin(phase * 0.5 + t));
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}