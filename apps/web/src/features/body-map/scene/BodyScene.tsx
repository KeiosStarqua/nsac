import { Suspense, useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import {
  ATTRIBUTION,
  getStructure,
  jointAnchor,
  modelUrl,
  structuresFor,
  type AnatomySystem,
  type Vec3,
} from "open-anatomy-3d";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// The GLB now uses EXT_meshopt_compression (added in commit bcf45cb), which three's
// GLTFLoader cannot decode unless a meshopt decoder is registered. Without this the
// model throws during load and the SceneBoundary fallback is shown ("body 3D not visible").
try {
  (GLTFLoader as unknown as { setMeshoptDecoder: (d: unknown) => void }).setMeshoptDecoder(MeshoptDecoder);
} catch {
  // ignore — decoder may already be set
}
import { flattenPubis, isPubisMesh, shouldHidePenis } from "../model/genitalia";
import { pickStructureKey, shouldReportHover, type HoverPoint } from "../model/hover";
import { structureKeyForMesh, type LayerMap } from "../model/layers";
import { materialSpec, selectedSpec, type MaterialSpec } from "../model/materials";
import { OrganFocus } from "./OrganFocus";
import { SceneBoundary } from "./SceneBoundary";

const MODEL_URL = modelUrl("male", "/models/");
const DEFAULT_CAMERA: [number, number, number] = [0, 0.92, 3.25];
const DEFAULT_TARGET: [number, number, number] = [0, 0.88, 0];

interface ViewBridgeControls {
  readonly target: THREE.Vector3;
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly update: () => void;
}

/**
 * Hands the non-drag camera actions to DOM buttons outside the canvas. Zoom is
 * clamped to the OrbitControls distance limits, rotation is a fixed azimuth
 * step and Reset returns to the default camera and target.
 */
function ViewBridge({ bridge }: { readonly bridge: MutableRefObject<ViewBridgeApi | null> }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as ViewBridgeControls | null;

  useEffect(() => {
    if (!controls) return;
    const ROTATION_STEP_DEGREES = 22.5;
    const rotate = (degrees: number) => {
      const offset = camera.position
        .clone()
        .sub(controls.target)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(degrees));
      camera.position.copy(controls.target).add(offset);
      controls.update();
    };
    const zoom = (factor: number) => {
      const offset = camera.position.clone().sub(controls.target);
      const length = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset.setLength(length));
      controls.update();
    };
    bridge.current = {
      rotateLeft: () => rotate(-ROTATION_STEP_DEGREES),
      rotateRight: () => rotate(ROTATION_STEP_DEGREES),
      zoomIn: () => zoom(0.8),
      zoomOut: () => zoom(1.25),
      reset: () => {
        camera.position.set(...DEFAULT_CAMERA);
        controls.target.set(...DEFAULT_TARGET);
        controls.update();
      },
    };
    return () => {
      bridge.current = null;
    };
  }, [camera, controls, bridge]);

  return null;
}

export interface BodySceneProps {
  readonly webglAvailable: boolean;
  readonly selected: string | null;
  readonly onSelect: (key: string) => void;
  /**
   * The catalog structure under the pointer, or null when it left the body.
   * Optional: the scene works without chrome listening.
   */
  readonly onHover?: (hover: HoverPoint | null) => void;
  readonly layers: LayerMap;
  readonly reducedMotion: boolean;
  readonly paused: boolean;
  /**
   * Where the loading pill sits. `bottom-left` (default, inside the overlay
   * card) matches the canvas card's free corner; `top` is for the `/body`
   * page, whose bottom-left carries the attribution line and bottom edge is
   * the layer rail under 900px.
   */
  readonly progressPlacement?: "bottomLeft" | "top";
  /**
   * Optional bridge to the imperative camera. The `/body` page fills this to
   * expose rotate/zoom/reset buttons; the HUD overlay leaves it unset.
   */
  readonly viewRef?: MutableRefObject<ViewBridgeApi | null>;
}

/** The non-drag camera actions the page's view buttons call. */
export interface ViewBridgeApi {
  readonly rotateLeft: () => void;
  readonly rotateRight: () => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly reset: () => void;
}

interface MeshEntry {
  readonly mesh: THREE.Mesh;
  readonly key: string | null;
  readonly system: AnatomySystem | null;
  readonly category: string | undefined;
}

interface PreparedModel {
  readonly object: THREE.Group;
  readonly entries: MeshEntry[];
  /** Geometries cloned for the pubic flatten, disposed when the model unmounts. */
  readonly cloned: THREE.BufferGeometry[];
}

function toMaterial(spec: MaterialSpec): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.color),
    emissive: new THREE.Color(spec.emissive),
    emissiveIntensity: spec.emissiveIntensity,
    opacity: spec.opacity,
    transparent: spec.transparent,
    depthWrite: spec.depthWrite,
    side: spec.side === "double" ? THREE.DoubleSide : THREE.FrontSide,
    roughness: 0.55,
    metalness: 0.1,
  });
}

/**
 * Press the skin's genital bulge back onto the pubic plane, in world space, on
 * a geometry of our own. Nothing is deleted (a cut would leave a hole in the
 * body shell) and the GLB is never written: the cached source geometry stays
 * pristine, so a remount always starts from the original shape.
 *
 * The asset's POSITION and NORMAL are normalized integer attributes, so both
 * are replaced with float32 copies before writing and recomputing normals.
 */
function flattenPubisGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const geometry = mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const count = position.count;
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    points[i * 3] = position.getX(i);
    points[i * 3 + 1] = position.getY(i);
    points[i * 3 + 2] = position.getZ(i);
  }

  mesh.updateWorldMatrix(true, false);
  const world = mesh.matrixWorld.clone();
  const inverse = world.clone().invert();
  const point = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    point.fromArray(points, i * 3).applyMatrix4(world);
    const [x, y, z] = flattenPubis([point.x, point.y, point.z]);
    if (x === point.x && y === point.y && z === point.z) continue;
    point.set(x, y, z).applyMatrix4(inverse).toArray(points, i * 3);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Clone once; materials are applied per selection in an effect. */
function prepareModel(source: THREE.Group): PreparedModel {
  const object = source.clone(true);
  const entries: MeshEntry[] = [];
  const cloned: THREE.BufferGeometry[] = [];
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (isPubisMesh(node.name)) {
      node.geometry = flattenPubisGeometry(node);
      cloned.push(node.geometry);
    }
    const key = structureKeyForMesh(node.name);
    const structure = key ? getStructure(key) : undefined;
    entries.push({
      mesh: node,
      key,
      system: structure?.system ?? null,
      category: structure?.category,
    });
  });
  return { object, entries, cloned };
}

const JOINT_HOTSPOTS: ReadonlyArray<{
  key: string;
  label: string;
  color: string;
  anchor: Vec3;
}> = structuresFor("male").flatMap((structure) => {
  if (structure.system !== "joints") return [];
  const anchor = jointAnchor(structure, "male");
  if (!anchor) return [];
  return [{ key: structure.key, label: structure.label, color: structure.color, anchor }];
});

function JointHotspots({ onSelect }: { onSelect: (key: string) => void }) {
  return (
    <group>
      {JOINT_HOTSPOTS.map((joint) => (
        <mesh
          key={joint.key}
          name={joint.key}
          position={joint.anchor}
          onClick={(event: ThreeEvent<MouseEvent>) => {
            event.stopPropagation();
            if (event.delta > 4) return;
            onSelect(joint.key);
          }}
        >
          <sphereGeometry args={[0.014, 16, 16]} />
          <meshBasicMaterial color={joint.color} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function BodyModel({
  selected,
  onSelect,
  layers,
  reducedMotion,
  reportHover,
}: Omit<BodySceneProps, "webglAvailable" | "paused" | "onHover"> & {
  readonly reportHover: (hover: HoverPoint | null) => void;
}) {
  const { scene } = useGLTF(MODEL_URL, false, true);
  const groupRef = useRef<THREE.Group>(null);
  const prepared = useMemo(() => prepareModel(scene), [scene]);

  useEffect(() => {
    const created: THREE.MeshStandardMaterial[] = [];
    for (const entry of prepared.entries) {
      const base = materialSpec(entry.system, entry.category);
      const spec = entry.key !== null && entry.key === selected ? selectedSpec(base) : base;
      const material = toMaterial(spec);
      entry.mesh.material = material;
      created.push(material);
    }
    return () => {
      for (const material of created) material.dispose();
    };
  }, [prepared, selected]);

  useEffect(() => {
    for (const entry of prepared.entries) {
      // `shouldHidePenis` wins over the rail: the genital mesh never appears.
      entry.mesh.visible = !shouldHidePenis(entry.mesh.name) && (entry.system ? layers[entry.system] : true);
    }
  }, [prepared, layers]);

  // A rail toggle changes what sits under a still pointer; drop the old facts
  // instead of describing a mesh that is no longer drawn.
  useEffect(() => {
    reportHover(null);
  }, [layers, reportHover]);

  useEffect(() => {
    const geometries = prepared.cloned;
    return () => {
      for (const geometry of geometries) geometry.dispose();
    };
  }, [prepared]);

  const downRef = useRef<{ x: number; y: number; touch: boolean } | null>(null);

  /** The hits the picking rule reads, in raycast order (closest first). */
  const hoverHits = (event: ThreeEvent<MouseEvent | PointerEvent>) =>
    event.intersections.map((hit) => ({ name: hit.object.name, visible: hit.object.visible }));

  /** Report whatever is under the pointer, or that the pointer left the body. */
  const hoverAt = (event: ThreeEvent<MouseEvent | PointerEvent>) => {
    const key = pickStructureKey(hoverHits(event));
    const { clientX, clientY } = event.nativeEvent;
    reportHover(key ? { key, x: clientX, y: clientY } : null);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > 4) return; // an orbit drag, not a pick
    const key = pickStructureKey(hoverHits(event));
    if (key) onSelect(key);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    // A finger never hovers: a tap pins the tooltip, a drag orbits.
    if (event.nativeEvent.pointerType === "touch") return;
    hoverAt(event);
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    const touch = event.nativeEvent.pointerType === "touch";
    downRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, touch };
    if (touch) reportHover(null); // a new touch drops the previous pin
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const down = downRef.current;
    downRef.current = null;
    if (!down?.touch) return; // the mouse already follows the cursor
    const { clientX, clientY } = event.nativeEvent;
    if (Math.hypot(clientX - down.x, clientY - down.y) > 4) return; // an orbit drag
    hoverAt(event); // a tap pins the facts where the finger landed
  };

  return (
    <>
      <group
        ref={groupRef}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={() => reportHover(null)}
        onPointerMissed={() => reportHover(null)}
      >
        <primitive object={prepared.object} />
        {layers.joints ? <JointHotspots onSelect={onSelect} /> : null}
      </group>
      <OrganFocus selected={selected} modelRef={groupRef} reducedMotion={reducedMotion} />
    </>
  );
}

function ModelProgress({ placement }: { placement: "bottomLeft" | "top" }) {
  const { active } = useProgress();
  if (!active) return null;
  const position =
    placement === "top"
      ? "top-[12px] right-[12px] max-[900px]:right-auto max-[900px]:left-[12px]"
      : "bottom-[14px] left-[16px]";
  return (
    <p
      className={`absolute ${position} m-0 rounded-[999px] border border-(--accent)/22 bg-(--bg)/72 px-[12px] py-[6px] font-(family-name:--mono) text-[10px] tracking-[0.16em] uppercase text-(--muted)`}
      role="status"
    >
      Loading the anatomy model…
    </p>
  );
}

function SceneFallback({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-content-center justify-items-center gap-[10px] p-[28px] text-center" role="status">
      <h3 className="m-0 text-[16px] font-normal text-(--text)">{title}</h3>
      <p className="m-0 max-w-[44ch] text-[13px] leading-[1.55] text-(--muted)">{detail}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-[4px] cursor-pointer rounded-[999px]! border border-(--accent)/45 bg-transparent px-[16px] py-[7px] text-[12px]! text-(--accent) hover:bg-(--accent)/12"
          onClick={onRetry}
        >
          Try again
        </button>
      ) : null}
      <p className="mt-[6px]! mb-0 max-w-[58ch] text-[10px] leading-[1.5] text-(--muted)">{ATTRIBUTION}</p>
    </div>
  );
}

/**
 * The canvas and the model loader. Mounted only from the overlay, behind a lazy
 * import, so three.js never reaches the HUD entry chunk.
 */
export default function BodyScene({ webglAvailable, onHover, progressPlacement = "bottomLeft", viewRef, ...props }: BodySceneProps) {
  // The pointer fires far more often than a tooltip needs to move; only a new
  // structure or a real step across the body reaches the chrome.
  const lastHover = useRef<HoverPoint | null>(null);
  const reportHover = useCallback(
    (next: HoverPoint | null) => {
      if (!shouldReportHover(lastHover.current, next)) return;
      lastHover.current = next;
      onHover?.(next);
    },
    [onHover],
  );

  if (!webglAvailable) {
    return (
      <SceneFallback
        title="3D is unavailable in this browser"
        detail="WebGL is switched off or unsupported, so the body map cannot be drawn. Every other part of the interface still works."
      />
    );
  }

  return (
    <SceneBoundary
      fallback={(retry) => (
        <SceneFallback
          title="The anatomy model did not load"
          detail="The 3D body could not be opened. Check that the model file is being served, then try again."
          onRetry={() => {
            useGLTF.clear(MODEL_URL);
            retry();
          }}
        />
      )}
    >
      <Canvas
        className="block size-full"
        dpr={[1, 1.75]}
        camera={{ position: DEFAULT_CAMERA, fov: 38, near: 0.05, far: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#050c16"]} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#bfe9ff", "#08101c", 1.1]} />
        <directionalLight position={[2.4, 4.2, 2.8]} intensity={1.35} color="#f4fbff" />
        <pointLight position={[-1.8, 2.2, -1.8]} intensity={14} color="#5eead4" distance={7} decay={2} />
        <Suspense fallback={null}>
          <BodyModel {...props} reportHover={reportHover} />
        </Suspense>
        {viewRef ? <ViewBridge bridge={viewRef} /> : null}
        <OrbitControls
          makeDefault
          target={DEFAULT_TARGET}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={0.22}
          maxDistance={6.5}
          autoRotate={props.selected === null && !props.reducedMotion && !props.paused}
          autoRotateSpeed={0.55}
        />
      </Canvas>
      <ModelProgress placement={progressPlacement} />
    </SceneBoundary>
  );
}
