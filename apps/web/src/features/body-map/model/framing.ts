// Camera framing maths for the body map. Pure numbers only, so tests can check
// that a box lands inside the frustum without importing three.js.
export type Vec3Tuple = [number, number, number];

export interface Box3Like {
  readonly min: Vec3Tuple;
  readonly max: Vec3Tuple;
}

export interface FramingOptions {
  /** Vertical field of view of the camera, degrees. */
  readonly fovDeg?: number;
  /** Viewport width / height; narrow portrait screens need more distance. */
  readonly aspect?: number;
  /** Room around the box; 1 is an exact fit. */
  readonly padding?: number;
  /** Unit vector from the box centre towards the camera. */
  readonly direction?: Vec3Tuple;
}

export interface Framing {
  readonly target: Vec3Tuple;
  readonly position: Vec3Tuple;
  readonly distance: number;
}

/** Used when a box has no usable extent, so the camera always keeps a sane pose. */
export const FALLBACK_DISTANCE = 2.6;
const MIN_DISTANCE = 0.18;

export function boxCenter(box: Box3Like): Vec3Tuple {
  return [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
}

export function boxSize(box: Box3Like): Vec3Tuple {
  return [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];
}

/** Radius of the sphere around the box: the conservative fit for any orientation. */
export function boxRadius(box: Box3Like): number {
  const [x, y, z] = boxSize(box);
  return Math.sqrt(x * x + y * y + z * z) / 2;
}

/**
 * Distance at which the box's bounding sphere fits the narrower of the vertical
 * and horizontal half-angles, times `padding`.
 */
export function framingDistance(box: Box3Like, fovDeg = 38, padding = 1.4, aspect = 1): number {
  const radius = boxRadius(box);
  const halfVertical = Math.max(0.05, (fovDeg * Math.PI) / 360);
  const halfHorizontal = Math.max(
    0.05,
    Math.atan(Math.tan(halfVertical) * Math.max(0.2, aspect)),
  );
  const half = Math.min(halfVertical, halfHorizontal);
  const distance = (radius / Math.sin(half)) * padding;
  if (!Number.isFinite(distance) || distance <= 0) return FALLBACK_DISTANCE;
  return Math.max(MIN_DISTANCE, distance);
}

/** Target and camera position that put the whole box in view from `direction`. */
export function frameBox(box: Box3Like, options: FramingOptions = {}): Framing {
  const { fovDeg = 38, aspect = 1, padding = 1.4, direction = [0, 0, 1] } = options;
  const target = boxCenter(box);
  const distance = framingDistance(box, fovDeg, padding, aspect);
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  const unit: Vec3Tuple =
    length > 1e-6
      ? [direction[0] / length, direction[1] / length, direction[2] / length]
      : [0, 0, 1];
  return {
    target,
    distance,
    position: [
      target[0] + unit[0] * distance,
      target[1] + unit[1] * distance,
      target[2] + unit[2] * distance,
    ],
  };
}
