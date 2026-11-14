// Camera framing maths for the spacecraft viewer. Pure numbers only, so tests
// can check that the box lands inside the frustum without importing three.js.
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
  /** Room around the box; 1 is an exact fit, ~1.2 fills 70–85% of the frame. */
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

/** Radius of the sphere around the box. Kept for diagnostics; framing uses the projected fit. */
export function boxRadius(box: Box3Like): number {
  const [x, y, z] = boxSize(box);
  return Math.sqrt(x * x + y * y + z * z) / 2;
}

function normalize(v: Vec3Tuple): Vec3Tuple {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (length < 1e-9) return [0, 0, 1];
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Right/up basis vectors orthogonal to the view direction (camera looks along -forward). */
export function viewBasis(direction: Vec3Tuple): { right: Vec3Tuple; up: Vec3Tuple } {
  const forward = normalize(direction);
  // Any reference vector not parallel to the view direction works as the "up" seed.
  const seed: Vec3Tuple = Math.abs(forward[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const right = normalize(cross(seed, forward));
  const up = normalize(cross(forward, right));
  return { right, up };
}

/**
 * Half-extents of the box projected onto the view plane perpendicular to
 * `direction`. Anchoring the fit to the actual silhouette (instead of the
 * bounding sphere) keeps a long truss filling the frame horizontally.
 */
export function projectedExtents(
  box: Box3Like,
  direction: Vec3Tuple = [0, 0, 1],
): { halfWidth: number; halfHeight: number } {
  const { right, up } = viewBasis(direction);
  const center = boxCenter(box);
  let halfWidth = 0;
  let halfHeight = 0;
  for (const x of [box.min[0], box.max[0]]) {
    for (const y of [box.min[1], box.max[1]]) {
      for (const z of [box.min[2], box.max[2]]) {
        const offset: Vec3Tuple = [x - center[0], y - center[1], z - center[2]];
        halfWidth = Math.max(halfWidth, Math.abs(dot(offset, right)));
        halfHeight = Math.max(halfHeight, Math.abs(dot(offset, up)));
      }
    }
  }
  return { halfWidth, halfHeight };
}

/**
 * Distance at which the box's projected silhouette fits the narrower of the
 * vertical and horizontal half-angles, times `padding`.
 */
export function framingDistance(
  box: Box3Like,
  fovDeg = 38,
  padding = 1.4,
  aspect = 1,
  direction: Vec3Tuple = [0, 0, 1],
): number {
  const { halfWidth, halfHeight } = projectedExtents(box, direction);
  const halfVertical = Math.max(0.05, (fovDeg * Math.PI) / 360);
  const halfHorizontal = Math.max(
    0.05,
    Math.atan(Math.tan(halfVertical) * Math.max(0.2, aspect)),
  );
  const distance = Math.max(
    halfHeight / Math.tan(halfVertical),
    halfWidth / Math.tan(halfHorizontal),
  );
  const scaled = distance * padding;
  if (!Number.isFinite(scaled) || scaled <= 0) return FALLBACK_DISTANCE;
  return Math.max(MIN_DISTANCE, scaled);
}

/** Target and camera position that put the box's silhouette in view from `direction`. */
export function frameBox(box: Box3Like, options: FramingOptions = {}): Framing {
  const { fovDeg = 38, aspect = 1, padding = 1.4, direction = [0, 0, 1] } = options;
  const target = boxCenter(box);
  const unit = normalize(direction);
  const distance = framingDistance(box, fovDeg, padding, aspect, unit);
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
