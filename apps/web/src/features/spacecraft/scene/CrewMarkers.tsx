"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { positionsAt } from "../model/crew-positions";
import type { CrewPresenceState } from "../model/presence";

/** The minimum a marker needs from the crew roster: an id and the initials it draws. */
export interface CrewMarkersPresence {
  readonly astronaut: { readonly id: string; readonly initial: string };
  readonly state: CrewPresenceState;
}

export interface CrewMarkersProps {
  readonly presence: ReadonlyArray<CrewMarkersPresence>;
  readonly reducedMotion: boolean;
}

interface MarkerStyle {
  readonly color: string;
  readonly radius: number;
  readonly sphereOpacity: number;
  readonly labelOpacity: number;
}

// Same reading as the avatar group: `mine` is the brightest cyan, `taken` the pale blue, `free`
// recedes. Nothing here is measured — these are illustrative crew positions (see the caption).
const MARKER_STYLE: Record<CrewPresenceState, MarkerStyle> = {
  mine: { color: "#5EEAD4", radius: 0.62, sphereOpacity: 1, labelOpacity: 1 },
  taken: { color: "#9FD8FF", radius: 0.56, sphereOpacity: 0.95, labelOpacity: 0.9 },
  free: { color: "#5EEAD4", radius: 0.5, sphereOpacity: 0.35, labelOpacity: 0.5 },
};

// 128 px reads as mush once the sprite is magnified; 256 keeps the two initials crisp and is still
// six small textures.
const TEXTURE_SIZE = 256;
const LABEL_SCALE = 8;
const LABEL_OFFSET_Y = 2.4;
const RENDER_ORDER = 20;
const PULSE_SPEED = 2.2;
const PULSE_AMPLITUDE = 0.18;

/** Display-only: markers must never intercept the stream loader's click-to-prioritise raycast. */
const NO_RAYCAST = () => null;

/**
 * Initials label: a canvas texture drawn at runtime (soft cyan glow behind white mono text), so
 * there is no font fetch and no image asset. Never drei's `<Text>`, which pulls a network font.
 */
function labelTexture(initial: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const centre = TEXTURE_SIZE / 2;
    const glow = ctx.createRadialGradient(centre, centre, 6, centre, centre, centre);
    glow.addColorStop(0, "rgba(255,255,255,0.22)");
    glow.addColorStop(0.4, "rgba(94,234,212,0.2)");
    glow.addColorStop(1, "rgba(94,234,212,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    // A dark halo under white glyphs: the station is pale, so the initials need to separate from
    // the hull as well as from space.
    ctx.font = `700 ${Math.round(TEXTURE_SIZE * 0.4)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(2,10,18,0.95)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#F4FFFD";
    ctx.fillText(initial, centre, centre + 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(initial, centre, centre + 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The six fictional crew members on the station, as telemetry-style markers: an emissive dot plus
 * a camera-facing initials sprite per member, drifting around a module anchor (fixture data in
 * `model/crew-positions.ts`). Rendering ignores depth so the markers read through the hull — that
 * is the point of the layer — and stops drifting entirely under reduced motion.
 *
 * Display only: no pointer handlers, no picking, no decisions.
 */
export function CrewMarkers({ presence, reducedMotion }: CrewMarkersProps) {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const spheres = useRef<Array<THREE.Mesh | null>>([]);

  const markers = useMemo(
    () =>
      presence.map((entry) => ({
        id: entry.astronaut.id,
        state: entry.state,
        style: MARKER_STYLE[entry.state],
        texture: labelTexture(entry.astronaut.initial),
      })),
    [presence],
  );

  // The anchors double as the first-frame position, so nothing flashes at the origin while the
  // station is still being framed.
  const anchors = useMemo(() => {
    const map = new Map<string, { x: number; y: number; z: number }>();
    for (const position of positionsAt(0, { static: true })) {
      map.set(position.astronautId, position);
    }
    return map;
  }, []);

  useEffect(
    () => () => {
      for (const marker of markers) marker.texture.dispose();
    },
    [markers],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const positions = positionsAt(t, { static: reducedMotion });
    const byId = new Map(positions.map((position) => [position.astronautId, position]));
    markers.forEach((marker, index) => {
      const group = groups.current[index];
      const position = byId.get(marker.id);
      if (!group || !position) return;
      group.position.set(position.x, position.y, position.z);
      const sphere = spheres.current[index];
      if (!sphere) return;
      // `mine` breathes gently so the visitor finds their own marker; static under reduced motion.
      const pulse =
        !reducedMotion && marker.state === "mine"
          ? 1 + PULSE_AMPLITUDE * Math.sin(t * PULSE_SPEED)
          : 1;
      sphere.scale.setScalar(pulse);
    });
  });

  return (
    <group name="crew-positions">
      {markers.map((marker, index) => {
        const anchor = anchors.get(marker.id);
        return (
          <group
            key={marker.id}
            position={anchor ? [anchor.x, anchor.y, anchor.z] : [0, 0, 0]}
            ref={(node) => {
              groups.current[index] = node;
            }}
          >
            <mesh
              renderOrder={RENDER_ORDER}
              raycast={NO_RAYCAST}
              ref={(node) => {
                spheres.current[index] = node;
              }}
            >
              <sphereGeometry args={[marker.style.radius, 16, 16]} />
              <meshBasicMaterial
                color={marker.style.color}
                transparent
                opacity={marker.style.sphereOpacity}
                depthTest={false}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <sprite
              position={[0, LABEL_OFFSET_Y, 0]}
              scale={[LABEL_SCALE, LABEL_SCALE, 1]}
              renderOrder={RENDER_ORDER}
              raycast={NO_RAYCAST}
            >
              <spriteMaterial
                map={marker.texture}
                transparent
                opacity={marker.style.labelOpacity}
                depthTest={false}
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
          </group>
        );
      })}
    </group>
  );
}
