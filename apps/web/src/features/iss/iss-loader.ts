// Framework-agnostic loading for the streamed ISS parts.
//
// - `loadISSManifest()` dedupes the manifest fetch in-flight (one request).
// - `ISSPartLoader` owns part-level state: concurrency-limited queue ordered by
//   priority, LRU cache of LOADED parts (max 6) with GPU dispose on eviction,
//   and in-flight promise dedup so concurrent requests share one download.
// - `THREE.Cache.enabled = true` (set below) so the 19 shared textures and the
//   .gltf/.bin payloads are fetched once per page — parts referencing the same
//   `../textures/<sha256>.png` decode the ImageBitmap again but hit the HTTP
//   cache for bytes. GPU-side each part uploads its own Texture objects (kept
//   simple on purpose: disposal per part stays trivially safe).
//
// Eviction note: parts currently mounted in the scene are pinned and never
// evicted. "Max 6 parts" applies to parts that left the scene (zoomed out of
// view) — they are disposed and reloaded from cache on return.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ISSStreamManifest, ISSStreamPart } from "./iss-types";

THREE.Cache.enabled = true;

const MANIFEST_URL = "/models/iss/streamed/manifest.json";
const MAX_CONCURRENT = 3;
const MAX_LOADED = 6;

// ---------------------------------------------------------------- manifest

let manifestPromise: Promise<ISSStreamManifest> | null = null;
let manifestSnapshot: ISSStreamManifest | null = null;

function validateManifest(raw: unknown): ISSStreamManifest {
  if (typeof raw !== "object" || raw === null) throw new Error("manifest: not an object");
  const m = raw as Record<string, unknown>;
  if (m.version !== 1) throw new Error(`manifest: unsupported version ${String(m.version)}`);
  if (typeof m.overview !== "string" || m.overview.length === 0)
    throw new Error("manifest: overview missing");
  if (!Array.isArray(m.parts) || m.parts.length === 0) throw new Error("manifest: parts missing");
  for (const [i, part] of (m.parts as unknown[]).entries()) {
    const p = part as Record<string, unknown>;
    if (typeof p.id !== "string" || p.id.length === 0) throw new Error(`manifest: part ${i} has no id`);
    if (typeof p.url !== "string" || p.url.length === 0) throw new Error(`manifest: part ${p.id} has no url`);
    for (const key of ["bytes", "geometryBytes", "textureBytes", "nodes"] as const) {
      const v = p[key];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
        throw new Error(`manifest: part ${p.id} field ${key} invalid`);
    }
    const bounds = p.bounds as { min?: unknown; max?: unknown } | undefined;
    const validBound = (v: unknown): boolean =>
      Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
    if (!bounds || !validBound(bounds.min) || !validBound(bounds.max))
      throw new Error(`manifest: part ${p.id} bounds invalid`);
  }
  return m as unknown as ISSStreamManifest;
}

export function loadISSManifest(): Promise<ISSStreamManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
        return res.json() as Promise<unknown>;
      })
      .then(validateManifest)
      .then((manifest) => {
        manifestSnapshot = manifest;
        return manifest;
      })
      .catch((error: unknown) => {
        manifestPromise = null; // allow a retry after a transient failure
        throw error instanceof Error ? error : new Error(String(error));
      });
  }
  return manifestPromise;
}

/** Already-resolved manifest (null until `loadISSManifest` succeeds). */
export function getISSManifest(): ISSStreamManifest | null {
  return manifestSnapshot;
}

// ------------------------------------------------------------------ parts

function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of materials) {
      for (const value of Object.values(m)) {
        if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
      }
      m.dispose();
    }
  });
}

export interface PartRelevance {
  readonly id: string;
  /** Projected radius of the part's bounding sphere, in pixels. */
  readonly pixelRadius: number;
  /** In frustum (sphere test with the current camera). */
  readonly inFrustum: boolean;
  /** Load-worthy right now (hysteresis band applied by the caller). */
  readonly keep: boolean;
}

type LoaderListener = () => void;

export class ISSPartLoader {
  private readonly byId = new Map<string, ISSStreamPart>();
  readonly totalBytes: number;
  readonly totalCount: number;

  private readonly loaded = new Map<string, THREE.Group>();
  private readonly lru: string[] = []; // oldest → newest
  private readonly inflight = new Map<string, Promise<THREE.Group>>();
  private readonly failed = new Map<string, string>();
  private readonly queued = new Map<string, number>(); // id → priority (not started yet)
  private readonly pinned = new Set<string>();
  private active = 0;
  private bytesLoaded = 0;
  private readonly listeners = new Set<LoaderListener>();

  constructor(manifest: ISSStreamManifest) {
    for (const part of manifest.parts) this.byId.set(part.id, part);
    this.totalBytes = manifest.parts.reduce((sum, part) => sum + part.bytes, 0);
    this.totalCount = manifest.parts.length;
  }

  // ---- stats ----------------------------------------------------------
  stats(): { loadedBytes: number; totalBytes: number; loadedCount: number; totalCount: number } {
    return {
      loadedBytes: this.bytesLoaded,
      totalBytes: this.totalBytes,
      loadedCount: this.loaded.size,
      totalCount: this.totalCount,
    };
  }

  loadedBytesValue(): number {
    return this.bytesLoaded;
  }

  isLoaded(id: string): boolean {
    return this.loaded.has(id);
  }

  isInFlight(id: string): boolean {
    return this.inflight.has(id);
  }

  failureOf(id: string): string | null {
    return this.failed.get(id) ?? null;
  }

  failures(): ReadonlyMap<string, string> {
    return this.failed;
  }

  loadedGroups(): Array<{ id: string; group: THREE.Group }> {
    return [...this.loaded.entries()].map(([id, group]) => ({ id, group }));
  }

  part(id: string): ISSStreamPart | undefined {
    return this.byId.get(id);
  }

  subscribe(listener: LoaderListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  // ---- scheduling -----------------------------------------------------

  /** Request a part; no-op if already loaded or in flight. Priority: higher wins. */
  request(id: string, priority: number): void {
    if (this.loaded.has(id) || this.inflight.has(id)) return;
    const current = this.queued.get(id);
    if (current === undefined || priority > current) this.queued.set(id, priority);
    this.pump();
  }

  /** Cancel queued (not yet started) parts by id. In-flight downloads are allowed to finish. */
  cancelQueued(ids: ReadonlySet<string>): void {
    for (const id of ids) this.queued.delete(id);
  }

  /** Retry a previously failed part. */
  retry(id: string): void {
    this.failed.delete(id);
    this.request(id, Number.MAX_SAFE_INTEGER);
  }

  private pump(): void {
    while (this.active < MAX_CONCURRENT && this.queued.size > 0) {
      let bestId: string | null = null;
      let bestPriority = -Infinity;
      for (const [id, priority] of this.queued) {
        if (priority > bestPriority) {
          bestPriority = priority;
          bestId = id;
        }
      }
      if (bestId === null) return;
      this.queued.delete(bestId);
      this.start(bestId);
    }
  }

  private start(id: string): void {
    const part = this.byId.get(id);
    if (!part || this.loaded.has(id) || this.inflight.has(id)) return;
    this.active += 1;
    const promise = this.loadPart(part)
      .then((group) => {
        this.loaded.set(id, group);
        this.lru.push(id);
        this.bytesLoaded += part.bytes;
        this.inflight.delete(id);
        this.failed.delete(id);
        this.active -= 1;
        // NOTE: no enforceLRU() here — the React layer pins parts only after
        // they commit, and an eviction landing before the pin would dispose
        // geometry/materials out from under the scene. Eviction happens in
        // unpin(), when a part actually leaves the view.
        this.pump();
        this.notify();
        return group;
      })
      .catch((error: unknown) => {
        this.inflight.delete(id);
        this.failed.set(id, error instanceof Error ? error.message : String(error));
        this.active -= 1;
        this.pump();
        this.notify();
        throw error instanceof Error ? error : new Error(String(error));
      });
    this.inflight.set(id, promise);
    // Swallow the rejection for callers that never await (fire-and-forget requests);
    // the failure is surfaced through `failed` and `subscribe`.
    promise.catch(() => {});
  }

  private async loadPart(part: ISSStreamPart): Promise<THREE.Group> {
    const loader = new GLTFLoader();
    // Phần streamed không nén Draco — không cần decoder.
    const gltf = await loader.loadAsync(part.url);
    const scene = gltf.scene;
    scene.userData.partId = part.id;
    scene.traverse((child) => {
      child.userData.partId = part.id;
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
      }
    });
    return scene;
  }

  /** Mark a part as currently shown; pinned parts are never evicted. */
  pin(id: string): void {
    this.pinned.add(id);
  }

  unpin(id: string): void {
    this.pinned.delete(id);
    this.enforceLRU();
  }

  /** Evict least-recently-used unpinned parts down to MAX_LOADED. */
  private enforceLRU(): void {
    while (this.loaded.size > MAX_LOADED) {
      let evictId: string | null = null;
      for (const id of this.lru) {
        if (!this.pinned.has(id)) {
          evictId = id;
          break;
        }
      }
      if (evictId === null) return; // everything is pinned — allow exceeding the cap
      const group = this.loaded.get(evictId);
      this.loaded.delete(evictId);
      this.lru.splice(this.lru.indexOf(evictId), 1);
      const part = this.byId.get(evictId);
      if (part) this.bytesLoaded -= part.bytes;
      if (group) disposeObject(group);
    }
  }

  /** Dispose every cached part (route teardown). */
  disposeAll(): void {
    for (const [id, group] of this.loaded) {
      this.lru.splice(this.lru.indexOf(id), 1);
      disposeObject(group);
    }
    this.loaded.clear();
    this.pinned.clear();
    this.queued.clear();
    this.failed.clear();
    this.bytesLoaded = 0;
    this.notify();
  }
}

/** One loader per manifest snapshot (module scope — survives route unmounts). */
let sharedLoader: ISSPartLoader | null = null;

export function getISSPartLoader(manifest?: ISSStreamManifest): ISSPartLoader | null {
  if (manifest) {
    if (sharedLoader) {
      // Manifest already cached — reuse the loader, ignore the new object.
      return sharedLoader;
    }
    sharedLoader = new ISSPartLoader(manifest);
  }
  return sharedLoader;
}
