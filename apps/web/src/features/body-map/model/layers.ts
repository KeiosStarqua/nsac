// Layer state and mesh-to-catalog mapping for the body map.
// Pure data only: the scene reads `layers[system]` to decide what is drawn.
import { SYSTEM_LABELS, getStructure, type AnatomySystem } from "open-anatomy-3d";

/** Layers are the six meshed body systems. Joint hotspots are not layers. */
export type LayerKey = "skin" | "skeleton" | "muscles" | "organs" | "vessels" | "nerves";

export type LayerState = Record<LayerKey, boolean>;

/** Alias kept for call sites written against the first draft's name. */
export type LayerMap = LayerState;

export const LAYER_KEYS: readonly LayerKey[] = [
  "skin",
  "skeleton",
  "muscles",
  "organs",
  "vessels",
  "nerves",
];

export const DEFAULT_LAYERS: LayerState = {
  skin: true,
  skeleton: true,
  muscles: true,
  organs: true,
  vessels: true,
  nerves: true,
};

export function layerLabel(key: LayerKey): string {
  return SYSTEM_LABELS[key as AnatomySystem];
}

export function atLeastOneLayer(layers: LayerState): boolean {
  return LAYER_KEYS.some((key) => layers[key]);
}

export function toggleLayer(layers: LayerState, key: LayerKey): LayerState {
  if (layers[key] && LAYER_KEYS.filter((other) => layers[other]).length <= 1) return layers;
  return { ...layers, [key]: !layers[key] };
}

const STRUCTURE_TO_MESH: Readonly<Record<string, string>> = { skin: "skin_1" };

export function structureKeyForMesh(meshName: string): string | null {
  const aliased = Object.entries(STRUCTURE_TO_MESH).find(([, mesh]) => mesh === meshName);
  const key = aliased ? aliased[0] : meshName;
  return getStructure(key) ? key : null;
}

export function meshNameForStructure(key: string): string {
  return STRUCTURE_TO_MESH[key] ?? key;
}