// Layer state and mesh-to-catalog mapping for the body map.
// Pure data only: the scene reads `layers[system]` to decide what is drawn.
import { SYSTEMS, SYSTEM_LABELS, getStructure, type AnatomySystem } from "open-anatomy-3d";

/** One flag per body system, including `joints` (hotspot markers rather than meshes). */
export type LayerMap = Record<AnatomySystem, boolean>;

/** Rail order is the catalog's order. */
export const LAYER_KEYS: readonly AnatomySystem[] = SYSTEMS;

export const DEFAULT_LAYERS: LayerMap = {
  skin: true,
  skeleton: true,
  joints: true,
  muscles: true,
  organs: true,
  vessels: true,
  nerves: true,
};

export function layerLabel(key: AnatomySystem): string {
  return SYSTEM_LABELS[key];
}

export function atLeastOneLayer(layers: LayerMap): boolean {
  return LAYER_KEYS.some((key) => layers[key]);
}

/** Turning off the last visible layer is a no-op: the hologram is never empty. */
export function toggleLayer(layers: LayerMap, key: AnatomySystem): LayerMap {
  if (layers[key] && LAYER_KEYS.filter((other) => layers[other]).length <= 1) return layers;
  return { ...layers, [key]: !layers[key] };
}

// The male GLB names the skin mesh `skin_1` while the catalog key is `skin`
// (every other mesh is named by its key). Kept here so the scene, the focus
// logic and the card agree on one mapping.
const STRUCTURE_TO_MESH: Readonly<Record<string, string>> = { skin: "skin_1" };

/** Catalog key for a glTF mesh name, or null when the mesh is not catalogued. */
export function structureKeyForMesh(meshName: string): string | null {
  const aliased = Object.entries(STRUCTURE_TO_MESH).find(([, mesh]) => mesh === meshName);
  const key = aliased ? aliased[0] : meshName;
  return getStructure(key) ? key : null;
}

/** glTF mesh name for a catalog key (the identity for everything but the skin). */
export function meshNameForStructure(key: string): string {
  return STRUCTURE_TO_MESH[key] ?? key;
}
