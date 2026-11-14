import { CATEGORY_COLORS, type AnatomySystem } from "open-anatomy-3d";

export interface MaterialSpec {
  readonly color: string;
  readonly emissive: string;
  readonly emissiveIntensity: number;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly depthWrite: boolean;
  readonly side: "front" | "double";
}

/**
 * Hologram look per system. Skin is a faint shell, bones read as pale blue
 * structure, organs take their catalog category colour, vessels and nerves are
 * thin emissive tints. Low contrast keeps the panel readable over the HUD.
 */
const SYSTEM_SPEC: Record<AnatomySystem, MaterialSpec> = {
  skin: { color: "#6fd6ff", emissive: "#0d3f5c", emissiveIntensity: 0.15, opacity: 0.1, transparent: true, depthWrite: false, side: "double" },
  skeleton: { color: "#9fc9ff", emissive: "#1b3f66", emissiveIntensity: 0.35, opacity: 0.55, transparent: true, depthWrite: true, side: "front" },
  joints: { color: "#ffd8a8", emissive: "#7a4a12", emissiveIntensity: 0.8, opacity: 0.9, transparent: true, depthWrite: false, side: "front" },
  muscles: { color: "#7f9ec2", emissive: "#132c44", emissiveIntensity: 0.2, opacity: 0.28, transparent: true, depthWrite: false, side: "front" },
  organs: { color: "#78eaff", emissive: "#1d6f8c", emissiveIntensity: 0.55, opacity: 0.85, transparent: false, depthWrite: true, side: "front" },
  vessels: { color: "#ff8fb0", emissive: "#7a1f3d", emissiveIntensity: 0.45, opacity: 0.6, transparent: true, depthWrite: false, side: "front" },
  nerves: { color: "#c8aaff", emissive: "#40246b", emissiveIntensity: 0.45, opacity: 0.55, transparent: true, depthWrite: false, side: "front" },
};

/** Fallback for an uncatalogued mesh: visible and neutral, never invisible by accident. */
const UNKNOWN_SPEC: MaterialSpec = {
  color: "#88ccff",
  emissive: "#123a5c",
  emissiveIntensity: 0.25,
  opacity: 0.4,
  transparent: true,
  depthWrite: false,
  side: "front",
};

/** Material for one structure, before selection highlighting. */
export function materialSpec(system: AnatomySystem | null, category?: string): MaterialSpec {
  if (system === null) return UNKNOWN_SPEC;
  const base = SYSTEM_SPEC[system];
  if (system === "organs" && category) {
    const colour = CATEGORY_COLORS[category];
    if (colour) return { ...base, color: colour, emissive: colour };
  }
  return base;
}

/** Same spec, brightened: the selected structure is the only one that glows. */
export function selectedSpec(spec: MaterialSpec): MaterialSpec {
  const opacity = Math.min(1, spec.opacity + 0.15);
  return {
    ...spec,
    opacity,
    transparent: opacity < 1,
    depthWrite: true,
    emissiveIntensity: Math.min(1.4, spec.emissiveIntensity + 0.65),
  };
}
