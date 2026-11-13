export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function easeInOut(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function angleToXY(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  const rad = (angle / 360) * Math.PI * 2 - Math.PI / 2;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

export function normalizeAngle(a: number): number {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
}

export function shortestAngleDelta(from: number, to: number): number {
  let d = normalizeAngle(to) - normalizeAngle(from);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}