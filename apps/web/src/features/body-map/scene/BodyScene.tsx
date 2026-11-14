import React, { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { modelUrl, structuresFor, CATEGORY_COLORS, SYSTEM_LABELS, getStructure, ATTRIBUTION } from "open-anatomy-3d";
import * as THREE from "three";
import LayerRail from "./LayerRail";
import OrganFocus from "./OrganFocus";

interface Props {
  selected: string | null;
  onSelect: (key: string) => void;
  layers: Record<string, boolean>;
  setLayers: (l: any) => void;
}

function SceneInner({ selected, onSelect, layers }: any) {
  const groupRef = useRef<any>(null);
  const { scene } = useGLTF(modelUrl("male", "/models/"), false, true) as any;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const materials = useMemo(() => {
    const m: Record<string, any> = {};
    // build per structure not needed; assign by mesh name at render
    return m;
  }, []);

  // clone scene
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // apply visibility by system layer
  useMemo(() => {
    cloned.traverse((obj: any) => {
      if (obj.isMesh) {
        const key = obj.name;
        const struct = getStructure(key);
        const layer = struct ? struct.system : null;
        const layerKey = layer === "joints" ? "organs" : layer;
        obj.visible = layerKey ? (layers as any)[layerKey] !== false : true;
        // material
        if (!obj.material) {
          obj.material = new THREE.MeshStandardMaterial({ color: "#88ccff", transparent: true, opacity: 0.3 });
        }
      }
    });
  }, [cloned, layers]);

  useFrame((_, delta) => {
    if (groupRef.current && !reduced && !document.hidden) {
      groupRef.current.rotation.y += 0.15 * delta;
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    const key = e.object?.name;
    if (key) onSelect(key);
  };

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 4, 2]} intensity={0.8} />
      <group ref={groupRef}>
        <primitive object={cloned} onClick={handleClick} />
      </group>
      {/* floor ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[0.9, 0.92, 64]} />
        <meshBasicMaterial color="#3a6" transparent opacity={0.4} />
      </mesh>
      <OrganFocus selected={selected} />
    </>
  );
}

export default function BodyScene({ selected, onSelect, layers, setLayers }: Props) {
  const [webglOk] = useState(() => {
    try { const c = document.createElement("canvas"); return !!c.getContext("webgl2") || !!c.getContext("webgl"); } catch { return false; }
  });

  if (!webglOk) {
    return <div style={{ color: "#faa", padding: 24 }}>WebGL is not available. {ATTRIBUTION}</div>;
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      <div style={{ flex: 1 }}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.1, 2.4], fov: 38 }} gl={{ antialias: true, alpha: true }}>
          <React.Suspense fallback={null}>
            <SceneInner selected={selected} onSelect={onSelect} layers={layers} />
          </React.Suspense>
          <OrbitControls makeDefault />
        </Canvas>
      </div>
      <div style={{ width: 260, padding: 12 }}>
        <LayerRail layers={layers} setLayers={setLayers} />
      </div>
    </div>
  );
}


