// Deterministic sparkline geometry for the `/` console.
//
// Pure and seeded: the same numbers render on the server and the client, so no hydration mismatch
// and no random walk. No React, no DOM — vitest covers it directly.
//
// Each row draws a smoothed cubic path through 24 fixture points (Catmull-Rom → cubic Bézier);
// the series is synthetic, exactly like the numbers it decorates.

/** Small deterministic PRNG (mulberry32). Same seed ⇒ same series, forever. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A plausible physiological squiggle around `baseline`: two summed sines for the slow trend plus
 * seeded jitter. Values are rounded to one decimal so the markup is byte-stable across runs.
 */
export function buildSeries(
  seed: number,
  count: number,
  baseline: number,
  amplitude: number,
): number[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => {
    const phase = index / Math.max(1, count - 1);
    const slow = Math.sin(phase * Math.PI * 2 * 1.35 + (seed % 7));
    const fast = Math.sin(phase * Math.PI * 2 * 3.1 + (seed % 5)) * 0.35;
    const jitter = (random() - 0.5) * 0.5;
    return Math.round((baseline + amplitude * (slow + fast + jitter)) * 10) / 10;
  });
}

export interface SparklineGeometry {
  /** Smoothed cubic path, ready for `d`. */
  readonly line: string;
  /** The same path closed along the baseline, for the faint fill. */
  readonly area: string;
  /** Last point, for the end dot. */
  readonly last: readonly [number, number];
}

/**
 * Catmull-Rom → cubic Bézier through `points`, scaled into a `width × height` box. Points are
 * normalized to their own min/max so every row uses its full vertical space.
 */
export function sparklinePath(
  points: readonly number[],
  width = 100,
  height = 32,
  pad = 3,
): SparklineGeometry | null {
  const data = points.filter((value) => Number.isFinite(value));
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const count = data.length;
  const coords = data.map((value, index) => {
    const x = count === 1 ? width : (index / (count - 1)) * width;
    const y = pad + (1 - (value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const at = (index: number): readonly [number, number] => {
    const clamped = Math.max(0, Math.min(count - 1, index));
    return coords[clamped]!;
  };
  const fixed = (n: number) => n.toFixed(2);

  let line = `M${fixed(coords[0]![0])},${fixed(coords[0]![1])}`;
  for (let index = 0; index < count - 1; index += 1) {
    const p0 = at(index - 1);
    const p1 = at(index);
    const p2 = at(index + 1);
    const p3 = at(index + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    line += ` C${fixed(c1x)},${fixed(c1y)} ${fixed(c2x)},${fixed(c2y)} ${fixed(p2[0])},${fixed(p2[1])}`;
  }

  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  const area = `${line} L${fixed(last[0])},${fixed(height)} L${fixed(first[0])},${fixed(height)} Z`;
  return { line, area, last };
}
