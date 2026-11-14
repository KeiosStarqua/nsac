import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import styles from "./SpacecraftScene.module.css";
import { DRACO_DECODER_PATH } from "../model/models";
import { frameBox, type Box3Like, type Framing } from "../model/framing";
import { SceneBoundary } from "./SceneBoundary";

const FOV = 38;
// Slightly above and to the side, like a tracking camera on the truss.
const VIEW_DIRECTION: [number, number, number] = [0.85, 0.42, 1];

export interface SpacecraftSceneProps {
  readonly modelUrl: string;
  readonly autoRotate: boolean;
  readonly reducedMotion: boolean;
  readonly paused: boolean;
}

function boxToLike(box: THREE.Box3): Box3Like {
  if (box.isEmpty()) {
    // A model with no measurable geometry still gets a sane framing.
    return { min: [-1, -1, -1], max: [1, 1, 1] };
  }
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  };
}

/** Studio-like lighting from three's example RoomEnvironment — no network fetch, so PBR/metal materials are not black. */
function RoomLighting() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    // Keep NASA's light materials from blowing out to pure white.
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      scene.environmentIntensity = 1;
      envMap.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Moves the camera onto the bounding-sphere fit whenever the model or the viewport changes. */
function FitCamera({ framing }: { framing: Framing }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    const [x, y, z] = framing.position;
    camera.position.set(x, y, z);
    if (camera instanceof THREE.PerspectiveCamera) {
      // Absolute near/far would clip a metre-scale or a kilometre-scale model.
      camera.near = Math.max(framing.distance / 1000, 0.001);
      camera.far = framing.distance * 100 + 10;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(framing.target[0], framing.target[1], framing.target[2]);
  }, [camera, framing]);
  return null;
}

function StationModel({ modelUrl, autoRotate, reducedMotion, paused }: SpacecraftSceneProps) {
  // ISS-B.glb needs KHR_draco_mesh_compression; the decoder is served from /draco/.
  const gltf = useGLTF(modelUrl, DRACO_DECODER_PATH);
  const size = useThree((state) => state.size);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const framing = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    return frameBox(boxToLike(box), {
      fovDeg: FOV,
      aspect,
      padding: 1.25,
      direction: VIEW_DIRECTION,
    });
  }, [gltf.scene, aspect]);

  return (
    <>
      <FitCamera framing={framing} />
      <primitive object={gltf.scene} />
      <OrbitControls
        makeDefault
        target={framing.target}
        enablePan
        enableDamping
        dampingFactor={0.08}
        minDistance={framing.distance * 0.15}
        maxDistance={framing.distance * 6}
        autoRotate={autoRotate && !reducedMotion && !paused}
        autoRotateSpeed={0.6}
      />
    </>
  );
}

function ModelProgress() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <p className={styles.progress} role="status">
      Loading model <strong>{Math.floor(progress)}%</strong>
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
    <div className={styles.fallback} role="status">
      <h3 className={styles.fallbackTitle}>{title}</h3>
      <p className={styles.fallbackDetail}>{detail}</p>
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      ) : null}
      <p className={styles.credit}>NASA — NASA 3D Resources / NASA VTAD</p>
    </div>
  );
}

/**
 * The canvas and the GLB loader. Mounted only from the page, behind a lazy
 * import, so three.js never reaches the HUD entry chunk.
 */
export default function SpacecraftScene({
  modelUrl,
  autoRotate,
  reducedMotion,
  paused,
}: SpacecraftSceneProps) {
  return (
    <SceneBoundary
      fallback={(retry) => (
        <SceneFallback
          title="The ISS model did not load"
          detail="The 3D model could not be opened. It may be too large for this connection, or the file may be missing. Check the network, then try again — the lightweight model is the default."
          onRetry={() => {
            useGLTF.clear(modelUrl);
            retry();
          }}
        />
      )}
    >
      <Canvas
        className={styles.canvas}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 100], fov: FOV, near: 0.1, far: 10000 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#050b14"]} />
        <ambientLight intensity={0.35} />
        <hemisphereLight args={["#cfe8ff", "#0a1220", 0.9]} />
        <directionalLight position={[60, 80, 40]} intensity={1.1} color="#f4fbff" />
        <directionalLight position={[-50, -30, -60]} intensity={0.4} color="#7dd3fc" />
        <RoomLighting />
        <Suspense fallback={null}>
          <StationModel
            modelUrl={modelUrl}
            autoRotate={autoRotate}
            reducedMotion={reducedMotion}
            paused={paused}
          />
        </Suspense>
      </Canvas>
      <ModelProgress />
    </SceneBoundary>
  );
}
