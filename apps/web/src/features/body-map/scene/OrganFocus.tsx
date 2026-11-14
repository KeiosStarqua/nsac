import React, { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export default function OrganFocus({ selected }: { selected: string | null }) {
  const controlsRef = useRef<any>(null);
  const { camera, scene } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 1, 0));
  const desiredPos = useRef(new THREE.Vector3(0, 1.1, 2.4));
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useFrame(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.lerp(targetRef.current, reduced ? 1 : 0.08);
    camera.position.lerp(desiredPos.current, reduced ? 1 : 0.08);
    controlsRef.current.update();
  });

  // On selected change, compute bbox
  React.useEffect(() => {
    if (!selected) {
      targetRef.current.set(0, 1, 0);
      desiredPos.current.set(0, 1.1, 2.4);
      return;
    }
    const obj = scene.getObjectByName(selected);
    if (obj) {
      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const radius = size.length() / 2;
      targetRef.current.copy(center);
      const dist = (radius / Math.sin((38 * Math.PI / 180) / 2)) * 1.4;
      desiredPos.current.set(center.x, center.y, center.z + (Number.isFinite(dist) ? dist : 2.4));
    }
  }, [selected, scene]);

  return <OrbitControls ref={controlsRef} makeDefault enableDamping />;
}
