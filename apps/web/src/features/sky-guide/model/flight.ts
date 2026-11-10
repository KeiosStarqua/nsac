// Pure flight math for the Sky companion. No DOM, no React: positions are viewport pixels.

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** Room left under the sticky header, so Sky never perches behind it. */
const HEADER_CLEARANCE = 72;
const EDGE = 8;

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Longer hops take longer, within bounds that keep a 60-second demo moving. */
export function flightDurationMs(from: Point, to: Point): number {
  return clamp(500 + distance(from, to) * 0.9, 600, 1800);
}

/** Control point of the arc: the midpoint lifted up, so Sky swoops instead of sliding. */
export function controlPoint(from: Point, to: Point): Point {
  const lift = Math.min(180, distance(from, to) * 0.35);
  return { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
}

/** Quadratic Bézier point at `t` in [0, 1]. */
export function bezier(from: Point, control: Point, to: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

/** Where Sky (a `size`-pixel square) perches on a station: over its top-right corner, kept on screen. */
export function perchFor(box: Box, viewport: Viewport, size: number): Point {
  return {
    x: clamp(box.right - size * 0.75, EDGE, viewport.width - size - EDGE),
    y: clamp(box.top - size * 0.55, HEADER_CLEARANCE, viewport.height - size - EDGE),
  };
}

/** Where Sky hovers when no station is in view: the right edge, a third of the way down. */
export function idlePoint(viewport: Viewport, size: number): Point {
  return {
    x: viewport.width - size - Math.max(EDGE, viewport.width * 0.03),
    y: clamp(viewport.height * 0.3, HEADER_CLEARANCE, viewport.height - size - EDGE),
  };
}

/**
 * The station Sky should fly to: among the stations inside the middle band of the viewport, the one
 * whose centre is closest to the reading line (45% down). `null` when none is in the band.
 */
export function pickStation<Id extends string>(
  stations: readonly { id: Id; box: Box }[],
  viewport: Viewport,
): Id | null {
  const bandTop = viewport.height * 0.12;
  const bandBottom = viewport.height * 0.88;
  const readingLine = viewport.height * 0.45;

  let best: Id | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const { id, box } of stations) {
    if (box.bottom < bandTop || box.top > bandBottom) continue;
    const gap = Math.abs((box.top + box.bottom) / 2 - readingLine);
    if (gap < bestGap) {
      best = id;
      bestGap = gap;
    }
  }
  return best;
}
