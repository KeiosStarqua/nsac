export interface Box3Like { min: [number, number, number]; max: [number, number, number]; }

export function boxCenter(box: Box3Like): [number, number, number] {
  return [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
}

export function boxSize(box: Box3Like): [number, number, number] {
  return [
    box.max[0] - box.min[0],
    box.max[1] - box.min[1],
    box.max[2] - box.min[2],
  ];
}

export function boxRadius(box: Box3Like): number {
  const s = boxSize(box);
  return Math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]) / 2;
}

export function framingDistance(box: Box3Like, fovDeg: number, padding = 1.4): number {
  const r = boxRadius(box);
  const fov = (fovDeg * Math.PI) / 180;
  const dist = (r / Math.sin(fov / 2)) * padding;
  return Number.isFinite(dist) && dist > 0 ? dist : 2.4;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}