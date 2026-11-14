// Pure maths for camera-relevance of streamed parts — vitest-covered.
// The frustum test itself lives in ISSStreamer (needs three's Frustum).
import type { ISSStreamPart } from "./iss-types";

export interface Sphere3 {
  readonly center: readonly [number, number, number];
  readonly radius: number;
}

/** Bounding sphere of a part, derived from the manifest bounds (world space). */
export function partSphere(part: ISSStreamPart): Sphere3 {
  const [minX, minY, minZ] = part.bounds.min;
  const [maxX, maxY, maxZ] = part.bounds.max;
  const center: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  return { center, radius: Math.sqrt(dx * dx + dy * dy + dz * dz) / 2 };
}

/**
 * Screen-space size of a bounding sphere, in pixels, for a perspective camera.
 * Used to decide stream relevance; see load/keep thresholds in ISSStreamer.
 */
export function projectedPixelRadius(
  sphereRadius: number,
  distanceToCamera: number,
  fovDeg: number,
  viewportHeightPx: number,
): number {
  if (!Number.isFinite(distanceToCamera) || distanceToCamera <= 1e-6) return Number.POSITIVE_INFINITY;
  const halfFov = (fovDeg * Math.PI) / 360;
  const visibleHalfHeight = Math.tan(halfFov) * distanceToCamera;
  if (visibleHalfHeight <= 0) return 0;
  return (sphereRadius / visibleHalfHeight) * (viewportHeightPx / 2);
}

/** Load parts at least this many pixels across-ish; below that, don't stream. */
export const STREAM_LOAD_PX = 60;
/** Hysteresis: a loaded part stays mounted down to this size before unloading. */
export const STREAM_KEEP_PX = 30;
