import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
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
import { structureKeyForMesh, type LayerMap } from "../model/layers";
import { materialSpec, selectedSpec, type MaterialSpec } from "../model/materials";
import { OrganFocus } from "./OrganFocus";
import { SceneBoundary } from "./SceneBoundary";

const MODEL_URL = modelUrl("male", "/models/");
const DEFAULT_CAMERA: [number, number, number] = [0, 0.92, 3.25];
const DEFAULT_TARGET: [number, number, number] = [0, 0.88, 0];

export interface BodySceneProps {
  readonly webglAvailable: boolean;
  readonly selected: string | null;
  readonly onSelect: (key: string) => void;
  readonly layers: LayerMap;
  readonly reducedMotion: boolean;
  readonly paused: boolean;
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

/** Clone once; materials are applied per selection in an effect. */
function prepareModel(source: THREE.Group): PreparedModel {
  const object = source.clone(true);
  const entries: MeshEntry[] = [];
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const key = structureKeyForMesh(node.name);
    const structure = key ? getStructure(key) : undefined;
    entries.push({
      mesh: node,
      key,
      system: structure?.system ?? null,
      category: structure?.category,
    });
  });
  return { object, entries };
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
}: Omit<BodySceneProps, "webglAvailable" | "paused">) {
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
      entry.mesh.visible = entry.system ? layers[entry.system] : true;
    }
  }, [prepared, layers]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > 4) return; // an orbit drag, not a pick
    let skinKey: string | null = null;
    for (const hit of event.intersections) {
      if (!hit.object.visible) continue; // a layer the rail switched off
      const key = structureKeyForMesh(hit.object.name);
      if (!key) continue;
      if (getStructure(key)?.system === "skin") {
        skinKey ??= key;
        continue;
      }
      onSelect(key);
      return;
    }
    if (skinKey) onSelect(skinKey);
  };

  return (
    <>
      <group ref={groupRef} onClick={handleClick}>
        <primitive object={prepared.object} />
        {layers.joints ? <JointHotspots onSelect={onSelect} /> : null}
      </group>
      <OrganFocus selected={selected} modelRef={groupRef} reducedMotion={reducedMotion} />
    </>
  );
}

function ModelProgress() {
  const { active } = useProgress();
  if (!active) return null;
  return (
    <p
      className="absolute bottom-[14px] left-[16px] m-0 rounded-[999px] border border-(--accent)/22 bg-(--bg)/72 px-[12px] py-[6px] font-(family-name:--mono) text-[10px] tracking-[0.16em] uppercase text-(--muted)"
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
export default function BodyScene({ webglAvailable, ...props }: BodySceneProps) {
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
          <BodyModel {...props} />
        </Suspense>
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
      <ModelProgress />
    </SceneBoundary>
  );
}
