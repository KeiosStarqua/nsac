import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { frameBox, type Box3Like, type Vec3Tuple } from "../model/framing";
import { meshNameForStructure } from "../model/layers";

const DURATION_SECONDS = 0.6;
const FALLBACK_BOX: Box3Like = { min: [-0.34, 0, -0.15], max: [0.34, 1.72, 0.15] };

/** The slice of drei's OrbitControls that the flight needs. */
interface OrbitLike {
  readonly target: THREE.Vector3;
  readonly update: () => void;
}

export interface OrganFocusProps {
  readonly selected: string | null;
  readonly modelRef: RefObject<THREE.Group | null>;
  readonly reducedMotion: boolean;
}

interface Flight {
  readonly fromPosition: THREE.Vector3;
  readonly toPosition: THREE.Vector3;
  readonly fromTarget: THREE.Vector3;
  readonly toTarget: THREE.Vector3;
  progress: number;
}

function toBox(box: THREE.Box3): Box3Like {
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  };
}

/**
 * Eases the camera to the selected structure's bounding box and back to the whole
 * body when the selection is cleared. The flight lasts ~600 ms; with reduced
 * motion the camera jumps straight to the destination.
 */
export function OrganFocus({ selected, modelRef, reducedMotion }: OrganFocusProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitLike | null;
  const flight = useRef<Flight | null>(null);

  useEffect(() => {
    if (!controls) return;
    const root = modelRef.current;
    const box = new THREE.Box3();
    let framed = false;

    if (selected && root) {
      const object = root.getObjectByName(meshNameForStructure(selected));
      if (object) {
        box.setFromObject(object);
        framed = !box.isEmpty();
      }
    }

    if (!framed) {
      if (root) box.setFromObject(root);
      if (!root || box.isEmpty()) {
        box.min.set(...FALLBACK_BOX.min);
        box.max.set(...FALLBACK_BOX.max);
      }
    }

    const direction = camera.position.clone().sub(controls.target);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
    const perspective = camera as THREE.PerspectiveCamera;
    const fovDeg = typeof perspective.fov === "number" ? perspective.fov : 38;
    const aspect = typeof perspective.aspect === "number" ? perspective.aspect : 1;
    const framing = frameBox(toBox(box), {
      fovDeg,
      aspect,
      padding: selected ? 1.45 : 1.15,
      direction: [direction.x, direction.y, direction.z],
    });
    const toPosition = new THREE.Vector3(...framing.position);
    const toTarget = new THREE.Vector3(...framing.target);

    if (reducedMotion) {
      camera.position.copy(toPosition);
      controls.target.copy(toTarget);
      controls.update();
      flight.current = null;
      return;
    }

    flight.current = {
      fromPosition: camera.position.clone(),
      toPosition,
      fromTarget: controls.target.clone(),
      toTarget,
      progress: 0,
    };
  }, [selected, modelRef, camera, controls, reducedMotion]);

  useFrame((_, delta) => {
    const current = flight.current;
    if (!current || !controls) return;
    current.progress = Math.min(1, current.progress + delta / DURATION_SECONDS);
    const eased = current.progress * current.progress * (3 - 2 * current.progress);
    camera.position.lerpVectors(current.fromPosition, current.toPosition, eased);
    controls.target.lerpVectors(current.fromTarget, current.toTarget, eased);
    controls.update();
    if (current.progress >= 1) flight.current = null;
  });

  return null;
}
