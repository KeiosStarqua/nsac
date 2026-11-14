// ISSStreamer — the streamed data path for /spacecraft.
//
// Paints the lightweight overview GLB (ISS-B) first, then streams the parts of
// the full-detail station around the current view, and crossfades the two once
// the initially-relevant parts are in. Lives inside the cinematic Canvas owned
// by features/spacecraft — this component never creates Canvas/OrbitControls/lights.
//
// Phases: "overview" → "crossfading" → "detail" (reactive, in useFrame).
// Relevance: parts are projected bounding spheres; a part streams in at ≥60 px,
// and a mounted part unloads only below ≥30 px (hysteresis). Loads run through
// ISSPartLoader (concurrency 3, LRU 6). Manual clicks boost a part to the front
// of the queue via raycast (dev ergonomics; works for any mounted part).
import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import { getISSPartLoader, getISSManifest, loadISSManifest } from "./iss-loader";
import type { ISSStreamManifest, ISSStreamStats } from "./iss-types";
import { partSphere, projectedPixelRadius, STREAM_LOAD_PX, STREAM_KEEP_PX } from "./iss-relevance";

export interface ISSFramingBox {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface ISSStreamerProps {
  readonly reducedMotion: boolean;
  /** Dev-only (?part=<id>): stream just this part; everything else waits. */
  readonly onlyPart?: string | null;
  readonly onFramingBox?: (box: ISSFramingBox) => void;
  readonly onStats?: (stats: ISSStreamStats) => void;
  /** SpacecraftScene renders the retry affordance outside the Canvas; this hands it the handler. */
  readonly retryRef?: MutableRefObject<(() => void) | null>;
}

const DRACO_DECODER_PATH = "/draco/"; // keep in sync with features/spacecraft (cross-feature import not allowed)
const OVERVIEW_FALLBACK_URL = "/models/iss/ISS-B.glb"; // = manifest.overview; used before the manifest arrives
const FADE_SECONDS = 0.6; // toàn cục overview → station
const PART_FADE_SECONDS = 0.3; // part đến sau crossfade

function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const materials = new Set<THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(m)) for (const x of m) materials.add(x);
    else if (m) materials.add(m);
  });
  return [...materials];
}

function setMaterialOpacity(materials: readonly THREE.Material[], opacity: number, transparent: boolean): void {
  for (const m of materials) {
    m.opacity = opacity;
    m.transparent = transparent;
    m.depthWrite = true;
  }
}

const _center = new THREE.Vector3();
const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _sphere = new THREE.Sphere();

export function ISSStreamer({ reducedMotion, onlyPart = null, onFramingBox, onStats, retryRef }: ISSStreamerProps) {
  const [manifest, setManifest] = useState<ISSStreamManifest | null>(() => getISSManifest());
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestRetryTick, setManifestRetryTick] = useState(0);
  const [phase, setPhase] = useState<"overview" | "crossfading" | "detail">("overview");
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loaderTick, setLoaderTick] = useState(0);
  const [mountedParts, setMountedParts] = useState<Array<{ id: string; group: THREE.Group }>>([]);
  const [keptParts, setKeptParts] = useState<ReadonlySet<string>>(() => new Set());

  // The overview (ISS-B). 466 KB, suspended until ready; plenty of time to hide behind the black.
  const overview = useGLTF(OVERVIEW_FALLBACK_URL, DRACO_DECODER_PATH);

  const fadeStartRef = useRef<number | null>(null);
  const overviewRef = useRef<THREE.Group>(null);
  const stationaryRef = useRef<THREE.Group>(null);
  const overviewMatsRef = useRef<THREE.Material[]>([]);
  const partMatsRef = useRef(new Map<string, THREE.Material[]>());
  const partMountedAtRef = useRef(new Map<string, number>());
  const mountedIdsRef = useRef(new Set<string>());
  const initialRelevantRef = useRef<ReadonlySet<string> | null>(null);
  const lastRelevanceAtRef = useRef(-1);
  const statsErrorRef = useRef<string | null>(null);
  const reportedPctRef = useRef(-1);

  // ---------- manifest ----------
  useEffect(() => {
    if (manifest) return;
    let alive = true;
    setManifestError(null);
    loadISSManifest()
      .then((m) => {
        if (!alive) return;
        getISSPartLoader(m); // create/reuse the shared loader for this manifest
        setManifest(m);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setManifestError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      alive = false;
    };
  }, [manifest, manifestRetryTick]);

  // ---------- loader subscription → mountedParts + tick ----------
  useEffect(() => {
    if (!manifest) return;
    const loader = getISSPartLoader();
    if (!loader) return;
    const sync = () => {
      setMountedParts(loader.loadedGroups());
      setLoaderTick((t) => t + 1);
    };
    sync();
    return loader.subscribe(sync);
  }, [manifest]);

  useEffect(() => {
    mountedIdsRef.current = new Set(mountedParts.map((p) => p.id));
    // Drop per-part material/map entries for unmounted parts, so re-mounts fade afresh.
    const ids = new Set(mountedParts.map((p) => p.id));
    for (const id of [...partMatsRef.current.keys()]) {
      if (!ids.has(id)) {
        partMatsRef.current.delete(id);
        partMountedAtRef.current.delete(id);
      }
    }
    for (const { id, group } of mountedParts) {
      if (!partMatsRef.current.has(id)) partMatsRef.current.set(id, collectMaterials(group));
    }
  }, [mountedParts]);

  // ---------- material lists for the overview ----------
  useEffect(() => {
    overviewMatsRef.current = collectMaterials(overview.scene);
    return () => {
      // Restore the useGLTF-cached scene before this component goes away.
      for (const m of overviewMatsRef.current) {
        m.opacity = 1;
        m.transparent = false;
        m.depthWrite = true;
      }
      overviewMatsRef.current = [];
    };
  }, [overview.scene]);

  // ---------- framing boxes ----------
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(overview.scene);
    if (box.isEmpty()) return;
    onFramingBox?.({
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview.scene]);

  const unionBox = useMemo<ISSFramingBox | null>(() => {
    if (!manifest) return null;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const part of manifest.parts) {
      const bMin = part.bounds.min;
      const bMax = part.bounds.max;
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k]!, bMin[k]!);
        max[k] = Math.max(max[k]!, bMax[k]!);
      }
    }
    return { min: min as unknown as [number, number, number], max: max as unknown as [number, number, number] };
  }, [manifest]);
  const unionBoxKey = unionBox ? `${unionBox.min.join(",")}|${unionBox.max.join(",")}` : null;
  useEffect(() => {
    if (unionBox) onFramingBox?.(unionBox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unionBoxKey]);


  // ---------- relevance + crossfade + opacity, per frame ----------
  const sphereData = useMemo(
    () => manifest?.parts.map((p) => ({ id: p.id, sphere: partSphere(p) })) ?? null,
    [manifest],
  );

  // Dev-only ?part=<id>: force-load just that part. Unknown ids degrade to normal streaming.
  const effectiveOnlyPart = useMemo(() => {
    if (!onlyPart) return null;
    if (!manifest) return null; // hold until the id can be validated
    return manifest.parts.some((p) => p.id === onlyPart) ? onlyPart : null;
  }, [onlyPart, manifest]);
  const holdForOnlyPart = Boolean(onlyPart && !manifest);

  const visibleParts = mountedParts.filter((p) => (effectiveOnlyPart ? p.id === effectiveOnlyPart : keptParts.has(p.id)));
  const visiblePartsKey = visibleParts.map((p) => p.id).sort().join("+");

  // Pin visible parts so the LRU never disposes them under us. The pin set is
  // diffed — a naive cleanup that unpins the whole old list would let the LRU
  // evict freshly loaded parts before the re-pin lands.
  const pinnedRef = useRef(new Set<string>());
  useEffect(() => {
    const loader = getISSPartLoader();
    if (!loader) return;
    const ids = new Set(visibleParts.map((p) => p.id));
    for (const old of pinnedRef.current) if (!ids.has(old)) loader.unpin(old);
    for (const id of ids) if (!pinnedRef.current.has(id)) loader.pin(id);
    pinnedRef.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePartsKey]);
  useEffect(() => {
    return () => {
      const loader = getISSPartLoader();
      if (!loader) return;
      for (const id of pinnedRef.current) loader.unpin(id);
      pinnedRef.current = new Set();
    };
  }, []);



  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const camera = state.camera as THREE.PerspectiveCamera;
    const loader = getISSPartLoader();

    // --- camera-relevance tick: 4 Hz, plenty for an autorotating station
    if (manifest && sphereData && !holdForOnlyPart && now - lastRelevanceAtRef.current > 0.25) {
      lastRelevanceAtRef.current = now;
      _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_projScreenMatrix);
      const heightPx = Math.max(1, state.size.height);
      const fov = camera.fov ?? 38;
      const next = new Set<string>();
      const requests: Array<{ id: string; priority: number }> = [];
      for (const { id, sphere } of sphereData) {
        _center.set(sphere.center[0], sphere.center[1], sphere.center[2]);
        const distance = camera.position.distanceTo(_center);
        const pixels = projectedPixelRadius(sphere.radius, distance, fov, heightPx);
        _sphere.center.copy(_center);
        _sphere.radius = sphere.radius;
        const inFrustum = _frustum.intersectsSphere(_sphere);
        const mounted = mountedIdsRef.current.has(id);
        // Hysteresis: a mounted part stays down to KEEP px; a new stream needs LOAD px in-frustum.
        const keep = mounted ? pixels >= STREAM_KEEP_PX : inFrustum && pixels >= STREAM_LOAD_PX;
        if (effectiveOnlyPart && effectiveOnlyPart !== id) {
          // dev-only forced mode: nothing else is kept or requested
          continue;
        }
        if (keep || effectiveOnlyPart === id) {
          next.add(id);
          if (loader && !loader.isLoaded(id)) {
            requests.push({ id, priority: effectiveOnlyPart === id ? Number.MAX_SAFE_INTEGER : pixels });
          }
        }
      }
      if (loader) {
        const cancel = new Set<string>();
        for (const { id } of sphereData) if (!next.has(id) && id !== effectiveOnlyPart) cancel.add(id);
        loader.cancelQueued(cancel);
        for (const { id, priority } of requests) loader.request(id, priority);
      }
      // Remember the initially relevant parts (first tick) for the crossfade condition.
      if (!initialRelevantRef.current) {
        const initial = new Set<string>();
        if (effectiveOnlyPart) initial.add(effectiveOnlyPart);
        else for (const id of next) initial.add(id);
        initialRelevantRef.current = initial;
      }
      setKeptParts((prev) => {
        if (prev.size === next.size) {
          let same = true;
          for (const id of next) if (!prev.has(id)) { same = false; break; }
          if (same) return prev;
        }
        return next;
      });
    }

    // --- crossfade bookkeeping
    if (phase === "overview" && loader && sphereData) {
      const initial = initialRelevantRef.current;
      const targetIds =
        initial && initial.size > 0 ? [...initial] : manifest ? manifest.parts.map((p) => p.id) : [];
      const failed = targetIds.filter((id) => loader.failureOf(id));
      if (failed.length > 0) {
        if (statsErrorRef.current !== "stream-failed") {
          statsErrorRef.current = "stream-failed";
          setStatsError("Full-detail stream failed — overview shown");
        }
      } else if (targetIds.length > 0 && targetIds.every((id) => loader.isLoaded(id))) {
        statsErrorRef.current = null;
        setStatsError(null);
        fadeStartRef.current = now;
        setPhase("crossfading");
      }
    } else if (phase === "detail" && loader) {
      // A late (background) part failure in detail mode is non-fatal: banner only.
      const anyFailure = loader.failures().size > 0;
      if (anyFailure && statsErrorRef.current !== "part-failed") {
        statsErrorRef.current = "part-failed";
        setStatsError("Some station detail failed to load");
      } else if (!anyFailure && statsErrorRef.current === "part-failed") {
        statsErrorRef.current = null;
        setStatsError(null);
      }
    }

    // --- global + per-part opacity
    let globalT = 1;
    if (phase === "overview") globalT = 0;
    else if (phase === "crossfading") {
      const start = fadeStartRef.current ?? now;
      const duration = reducedMotion ? 1e-3 : FADE_SECONDS;
      globalT = Math.min(1, (now - start) / duration);
      if (globalT >= 1) setPhase("detail");
    }

    if (overviewRef.current) overviewRef.current.visible = globalT < 0.999;
    if (stationaryRef.current) stationaryRef.current.visible = globalT > 0.001;
    if (overviewMatsRef.current.length > 0) {
      const opacity = 1 - globalT;
      setMaterialOpacity(overviewMatsRef.current, opacity, opacity < 0.999);
    }
    for (const { id } of visibleParts) {
      const mountedAt = partMountedAtRef.current.get(id);
      if (mountedAt === undefined) partMountedAtRef.current.set(id, now);
      const per = Math.min(1, (now - (mountedAt ?? now)) / (reducedMotion ? 1e-3 : PART_FADE_SECONDS));
      const opacity = Math.min(per, globalT);
      const materials = partMatsRef.current.get(id);
      if (materials) setMaterialOpacity(materials, opacity, opacity < 0.999);
    }
  });

  // ---------- stats reporting ----------
  const reportStats = useCallback(() => {
    const loader = getISSPartLoader();
    if (!loader || !onStats) return;
    const stats = loader.stats();
    onStats({ ...stats, phase, error: statsError ?? manifestError });
  }, [onStats, phase, statsError, manifestError]);

  useEffect(() => {
    reportStats();
  }, [reportStats, loaderTick]);

  // NN% must reflect bytes; throttle to integer percent changes for the host.
  const reportBytePercent = useCallback(() => {
    const loader = getISSPartLoader();
    if (!loader || !onStats) return;
    const pct = Math.floor((loader.stats().loadedBytes / Math.max(1, loader.stats().totalBytes)) * 100);
    if (pct !== reportedPctRef.current) {
      reportedPctRef.current = pct;
      reportStats();
    }
  }, [onStats, reportStats]);
  useEffect(() => {
    reportBytePercent();
  }, [reportBytePercent, loaderTick]);

  // ---------- retry ----------
  const retryFailed = useCallback(() => {
    const loader = getISSPartLoader();
    if (loader) {
      const failed = [...loader.failures().keys()];
      for (const id of failed) loader.retry(id);
    }
    statsErrorRef.current = null;
    setStatsError(null);
    setManifestRetryTick((t) => t + 1); // re-fetch the manifest too (no-op if healthy)
  }, []);

  useEffect(() => {
    if (!retryRef) return;
    retryRef.current = retryFailed;
    return () => {
      retryRef.current = null;
    };
  }, [retryRef, retryFailed]);

  return (
    <>
      {/* Overview: overview model (ISS-B). Hidden once the swap completes. */}
      {phase !== "detail" ? (
        <group ref={overviewRef}>
          <primitive object={overview.scene} />
        </group>
      ) : null}

      {/* Streamed full-detail parts. */}
      <group ref={stationaryRef} onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        let obj: THREE.Object3D | null = event.object;
        const loader = getISSPartLoader();
        while (obj) {
          const id = obj.userData?.partId as string | undefined;
          if (id && loader) {
            loader.request(id, Number.MAX_SAFE_INTEGER);
            break;
          }
          obj = obj.parent;
        }
      }}>
        {visibleParts.map(({ id, group }) => (
          <primitive key={id} object={group} />
        ))}
      </group>

    </>
  );
}
