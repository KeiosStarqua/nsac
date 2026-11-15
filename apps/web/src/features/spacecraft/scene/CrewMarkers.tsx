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
  free: { color: "#5EEAD4", radius: 0.5, sphereOpacity: 0.35, labelOpacity: 0.55 },
};

// 128 px reads as mush once the sprite is magnified; 256 keeps the initials crisp and still six
// small textures (the portraits use the same canvas, so one texture per member either way).
const TEXTURE_SIZE = 256;
// Portrait circle: 34% of the texture per radius, so the avatar reads at the default fit and the
// cyan halo still rings it. The initials fallback draws at the same centre.
const AVATAR_RADIUS_RATIO = 0.34;
// Label plane in world units: big enough to read at the default fit, small enough that the two
// closest anchors (Unity/Destiny and Tranquility/Cupola) do not stack their labels.
const LABEL_SCALE = 5.2;
const LABEL_OFFSET_Y = 2.4;
const RENDER_ORDER = 20;
const PULSE_SPEED = 2.2;
const PULSE_AMPLITUDE = 0.18;
// A standing marker settles into a smaller, calmer dot; walking ones stay full size. The motion
// itself is the cue (see `positionsAt`) — this only keeps a stopped crew member from looking restless.
const HOLD_SCALE = 0.72;

/** Display-only: markers must never intercept the stream loader's click-to-prioritise raycast. */
const NO_RAYCAST = () => null;

/** A label texture that can be disposed while its portrait is still downloading. */
interface CrewLabelTexture extends THREE.CanvasTexture {
  disposed?: boolean;
}

/**
 * Crew portrait drawn into the label texture: the same `/astronauts/<id>.png` file the picker and
 * the presence chips use, cover-cropped into a circle, ringed in the marker's presence colour.
 */
function drawPortrait(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  colour: string,
  centre: number,
  radius: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centre, centre, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, 0, 0, image.width, image.height, centre - radius, centre - radius, radius * 2, radius * 2);
  ctx.restore();
  // Presence rim + a thin dark edge so the portrait separates from the pale hull.
  ctx.beginPath();
  ctx.arc(centre, centre, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(2,10,18,0.85)";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 6;
  ctx.stroke();
}

/**
 * Marker label: a canvas texture drawn at runtime — first the initials (soft glow behind white
 * mono text), then the crew portrait over it once it decodes. Either way there is no font fetch
 * and no DOM. Never drei's `<Text>`, which pulls a network font, nor `<Html>`, which is chrome.
 */
function labelTexture(astronaut: { readonly id: string; readonly initial: string }, colour: string): CrewLabelTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const centre = TEXTURE_SIZE / 2;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const glow = ctx.createRadialGradient(centre, centre, 6, centre, centre, centre);
    glow.addColorStop(0, "rgba(255,255,255,0.22)");
    glow.addColorStop(0.4, "rgba(94,234,212,0.2)");
    glow.addColorStop(1, "rgba(94,234,212,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    // A dark halo under white glyphs: the station is pale, so the initials need to separate from
    // the hull as well as from space. This is also the fallback when the portrait fails to load.
    ctx.font = `700 ${Math.round(TEXTURE_SIZE * 0.4)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(2,10,18,0.95)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#F4FFFD";
    ctx.fillText(astronaut.initial, centre, centre + 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(astronaut.initial, centre, centre + 4);
  }
  const texture: CrewLabelTexture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  // The portrait replaces the initials in the same texture when it decodes; a failed load keeps
  // the initials, and a texture disposed mid-download is left alone (no upload after dispose).
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    if (texture.disposed) return;
    const live = canvas.getContext("2d");
    if (!live) return;
    drawPortrait(live, image, colour, centre, TEXTURE_SIZE * AVATAR_RADIUS_RATIO);
    texture.needsUpdate = true;
  };
  image.src = `/astronauts/${astronaut.id}.png`;
  return texture;
}

/**
 * The six fictional crew members on the station, as telemetry-style markers: an emissive dot plus
 * a camera-facing portrait sprite per member (initials fallback), walking a closed patrol loop
 * through the connected modules with a standing pause at every waypoint (fixture data in
 * `model/crew-positions.ts`) — `phase: "walk" | "hold"` settles the dot while the member is
 * standing. Rendering ignores depth so the markers read through the hull — that is the point of
 * the layer — and stops moving entirely under reduced motion.
 *
 * Display only: no pointer handlers, no picking, no decisions.
 */
export function CrewMarkers({ presence, reducedMotion }: CrewMarkersProps) {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const spheres = useRef<Array<THREE.Mesh | null>>([]);

  const markers = useMemo(
    () =>
      presence.map((entry) => {
        const style = MARKER_STYLE[entry.state];
        return {
          id: entry.astronaut.id,
          state: entry.state,
          style,
          texture: labelTexture(entry.astronaut, style.color),
        };
      }),
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
      for (const marker of markers) {
        marker.texture.disposed = true;
        marker.texture.dispose();
      }
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
        !reducedMotion && marker.state === "mine" && position.phase !== "hold"
          ? 1 + PULSE_AMPLITUDE * Math.sin(t * PULSE_SPEED)
          : 1;
      const settle = position.phase === "hold" ? HOLD_SCALE : 1;
      sphere.scale.setScalar(pulse * settle);
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
