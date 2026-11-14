import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DRACO_DECODER_PATH } from "../model/models";
import { frameBox, type Box3Like, type Framing } from "../model/framing";
import { ISSStreamer, type ISSFramingBox, type ISSStreamStats } from "~/features/iss";
import { SceneBoundary } from "./SceneBoundary";

const FOV = 38;
// Slightly above and to the side, like a tracking camera on the truss.
const VIEW_DIRECTION: [number, number, number] = [0.85, 0.42, 1];
// Bounding-box fit with a little headroom: the station fills roughly 70–85% of the frame.
const FIT_PADDING = 1.18;

export interface SpacecraftSceneProps {
  readonly modelUrl: string;
  readonly stream: boolean;
  /** Dev-only (?part=<id>): stream just one streamed part. */
  readonly onlyPart: string | null;
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

/**
 * Two sparse star layers that drift very slowly around the view axis —
 * cheap parallax without post-processing. Motion stops under reduced motion.
 */
function DriftingStars({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (reducedMotion || !group.current) return;
    group.current.rotation.y += delta * 0.0042;
    group.current.rotation.x += delta * 0.0016;
  });
  return (
    <group ref={group}>
      {/* Distant, fine grain */}
      <Stars radius={140} depth={70} count={2400} factor={2.1} saturation={0} fade speed={reducedMotion ? 0 : 0.35} />
      {/* Nearer, slightly brighter sparse layer */}
      <Stars radius={70} depth={45} count={650} factor={3.4} saturation={0} fade speed={reducedMotion ? 0 : 0.5} />
    </group>
  );
}

/**
 * Studio-like PBR environment, dimmed low so it separates the metal from the
 * black backdrop without lifting the scene into "studio grey". No network fetch.
 */
function RoomLighting() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.38;
    return () => {
      scene.environment = null;
      scene.environmentIntensity = 1;
      envMap.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Moves the camera onto the projected-box fit whenever the model or the viewport changes. */
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

function framedFromBox(box: Box3Like, aspect: number): Framing {
  return frameBox(box, {
    fovDeg: FOV,
    aspect,
    padding: FIT_PADDING,
    direction: VIEW_DIRECTION,
  });
}

/** OrbitControls + projected-box camera fit; framing-only, mounted per data path. */
function FramedOrbitControls({ framing, autoRotate, reducedMotion, paused }: { framing: Framing; autoRotate: boolean; reducedMotion: boolean; paused: boolean }) {
  return (
    <OrbitControls
      makeDefault
      target={framing.target}
      enablePan
      enableDamping
      dampingFactor={0.08}
      minDistance={framing.distance * 0.15}
      maxDistance={framing.distance * 6}
      autoRotate={autoRotate && !reducedMotion && !paused}
      autoRotateSpeed={0.35}
    />
  );
}

function StationModel({ modelUrl, autoRotate, reducedMotion, paused }: Pick<SpacecraftSceneProps, "modelUrl" | "autoRotate" | "reducedMotion" | "paused">) {
  // ISS-B.glb needs KHR_draco_mesh_compression; the decoder is served from /draco/.
  // ISS-stationary.glb is uncompressed; the decoder path is simply unused for it.
  const gltf = useGLTF(modelUrl, DRACO_DECODER_PATH);
  const size = useThree((state) => state.size);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const framing = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    return framedFromBox(boxToLike(box), aspect);
  }, [gltf.scene, aspect]);

  return (
    <>
      <FitCamera framing={framing} />
      <primitive object={gltf.scene} />
      <FramedOrbitControls framing={framing} autoRotate={autoRotate} reducedMotion={reducedMotion} paused={paused} />
    </>
  );
}

function boxLikeFromFramingBox(box: ISSFramingBox): Box3Like {
  return {
    min: [box.min[0], box.min[1], box.min[2]],
    max: [box.max[0], box.max[1], box.max[2]],
  };
}

/**
 * Streamed data path: ISS-B paints first; parts of the full-detail model
 * stream around the camera; a global crossfade swaps ISS-B for the streamed
 * station once the initially-relevant parts are in.
 */
function StreamedModel({ onlyPart, autoRotate, reducedMotion, paused, onStats, retryRef }: {
  onlyPart: string | null;
  autoRotate: boolean;
  reducedMotion: boolean;
  paused: boolean;
  onStats: (stats: ISSStreamStats) => void;
  retryRef: { current: (() => void) | null };
}) {
  const size = useThree((state) => state.size);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const [streamBox, setStreamBox] = useState<Box3Like | null>(null);

  const framing = useMemo(
    () => (streamBox ? framedFromBox(streamBox, aspect) : null),
    [streamBox, aspect],
  );

  return (
    <>
      {framing ? <FitCamera framing={framing} /> : null}
      <ISSStreamer
        reducedMotion={reducedMotion}
        onlyPart={onlyPart}
        onFramingBox={(box) => setStreamBox(boxLikeFromFramingBox(box))}
        onStats={onStats}
        retryRef={retryRef}
      />
      {framing ? (
        <FramedOrbitControls framing={framing} autoRotate={autoRotate} reducedMotion={reducedMotion} paused={paused} />
      ) : null}
    </>
  );
}

/** Bare percent — bytes streamed in stream mode, model parse percent otherwise. */
function ModelProgress({ streamStats }: { streamStats: ISSStreamStats | null }) {
  const { active, progress } = useProgress();
  if (streamStats) {
    if (streamStats.phase === "detail") return null;
    const pct = Math.floor((streamStats.loadedBytes / Math.max(1, streamStats.totalBytes)) * 100);
    return (
      <p
        className="pointer-events-none absolute right-[clamp(14px,2vw,26px)] bottom-[clamp(14px,2vh,24px)] m-0 p-0 font-(family-name:--mono) text-[10px] tracking-[0.14em] tabular-nums text-(--text)/38 select-none"
        role="status"
        aria-label={`Loading model: ${pct} percent`}
      >
        {pct}%
      </p>
    );
  }
  if (!active) return null;
  return (
    <p
      className="pointer-events-none absolute right-[clamp(14px,2vw,26px)] bottom-[clamp(14px,2vh,24px)] m-0 p-0 font-(family-name:--mono) text-[10px] tracking-[0.14em] tabular-nums text-(--text)/38 select-none"
      role="status"
      aria-label={`Loading model: ${Math.floor(progress)} percent`}
    >
      {Math.floor(progress)}%
    </p>
  );
}

function SceneFallback({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-content-center justify-items-center gap-[12px] p-[28px] text-center" role="status">
      <p className="m-0 font-(family-name:--mono) text-[11px] font-normal tracking-[0.22em] uppercase text-(--muted)/85">
        Spacecraft unavailable
      </p>
      {onRetry ? (
        <button
          type="button"
          className="mt-[2px] cursor-pointer rounded-[999px]! border border-(--text)/22 bg-transparent px-[18px] py-[7px] text-[11px]! tracking-[0.08em] text-(--text)/70 hover:bg-(--text)/8"
          onClick={onRetry}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * The canvas, lights and GLB loader. Mounted only from the page, behind a lazy
 * import, so three.js never reaches the HUD entry chunk. The canvas is
 * transparent: the nebula/stars live in CSS layers behind it and drei <Stars/>
 * inside the scene.
 */
export default function SpacecraftScene({
  modelUrl,
  stream,
  onlyPart,
  autoRotate,
  reducedMotion,
  paused,
}: SpacecraftSceneProps) {
  const [streamStats, setStreamStats] = useState<ISSStreamStats | null>(null);
  const retryRef = useRef<(() => void) | null>(null);

  return (
    <SceneBoundary
      fallback={(retry) => (
        <SceneFallback
          onRetry={() => {
            useGLTF.clear(modelUrl);
            useGLTF.clear("/models/iss/ISS-B.glb");
            retry();
          }}
        />
      )}
    >
      <Canvas
        className="absolute inset-0 block size-full"
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 100], fov: FOV, near: 0.1, far: 10000 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        {/* Cinematic split lighting: cool cyan-white rim from behind/above to
            separate the truss from the black, a dim violet fill from the front,
            and a faint blue underlight. No bloom pass — @react-three/postprocessing
            is not a dependency; separation is done with lights and a CSS glow. */}
        <ambientLight intensity={0.12} />
        <hemisphereLight args={["#182038", "#02040a", 0.5]} />
        <directionalLight position={[-55, 70, -85]} intensity={2.4} color="#dceeff" />
        <directionalLight position={[46, 18, 60]} intensity={0.55} color="#8f7cf0" />
        <directionalLight position={[20, -60, 30]} intensity={0.35} color="#3d6fb4" />
        <pointLight position={[0, 8, -40]} intensity={3000} color="#9fd8ff" distance={260} decay={2} />
        <RoomLighting />
        <DriftingStars reducedMotion={reducedMotion} />
        <Suspense fallback={null}>
          {stream ? (
            <StreamedModel
              onlyPart={onlyPart}
              autoRotate={autoRotate}
              reducedMotion={reducedMotion}
              paused={paused}
              onStats={setStreamStats}
              retryRef={retryRef}
            />
          ) : (
            <StationModel
              modelUrl={modelUrl}
              autoRotate={autoRotate}
              reducedMotion={reducedMotion}
              paused={paused}
            />
          )}
        </Suspense>
      </Canvas>
      <ModelProgress streamStats={stream ? streamStats : null} />
      {stream && streamStats?.error ? (
        <div
          className="absolute left-[clamp(14px,2vw,26px)] bottom-[clamp(14px,2vh,24px)] flex items-center gap-[10px] font-(family-name:--mono) text-[10px] tracking-[0.06em] text-(--muted)/90 select-none"
          role="status"
        >
          <span>{streamStats.error}</span>
          <button
            type="button"
            className="cursor-pointer rounded-[999px]! border border-(--text)/18 bg-transparent px-[12px] py-[3px] text-[10px]! tracking-[0.08em] text-(--text)/62 hover:bg-(--text)/8"
            onClick={() => retryRef.current?.()}
          >
            Retry
          </button>
        </div>
      ) : null}
    </SceneBoundary>
  );
}
