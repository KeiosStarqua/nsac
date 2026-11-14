// Types for the streamed ISS viewer. Kept React-free so vitest can cover them.
// The manifest is produced by scripts/iss/split-iss.ts — keep them in sync.

export interface ISSStreamPartBounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface ISSStreamPart {
  /** Stable id, e.g. "truss-s0". */
  readonly id: string;
  /** URL of the .gltf, resolved against the app origin. */
  readonly url: string;
  /**
   * Real network bytes for this part (.gltf + .bin + textures that no earlier
   * part in manifest order already paid for). Summing `bytes` over all parts
   * gives the on-the-wire total with shared textures counted exactly once.
   */
  readonly bytes: number;
  /** Size of the part's .bin buffer (geometry + attributes), in bytes. */
  readonly geometryBytes: number;
  /** Bytes of all textures referenced by this part (whether shared or not). */
  readonly textureBytes: number;
  /** Filenames under …/streamed/textures/ referenced by this part. */
  readonly textures: readonly string[];
  /** World-space bounds, computed from accessor min/max + real world matrices. */
  readonly bounds: ISSStreamPartBounds;
  /** Number of nodes in the part (matches the split claim table). */
  readonly nodes: number;
}

export interface ISSStreamManifest {
  readonly version: number;
  /** Lightweight model painted first, e.g. "/models/iss/ISS-B.glb". */
  readonly overview: string;
  readonly totalGeometryBytes: number;
  readonly totalTextureBytes: number;
  readonly parts: readonly ISSStreamPart[];
}

/** Stats the viewer reports to its host, throttled by React render. */
export interface ISSStreamStats {
  readonly loadedBytes: number;
  readonly totalBytes: number;
  readonly loadedCount: number;
  readonly totalCount: number;
  readonly phase: "overview" | "crossfading" | "detail";
  /** Human-readable reason the detail stream is not (fully) available. */
  readonly error: string | null;
}
