import { getStructure } from "open-anatomy-3d";

export type LayerKey = "skin" | "skeleton" | "muscles" | "organs" | "vessels" | "nerves";

export const LAYER_KEYS: readonly LayerKey[] = ["skin", "skeleton", "muscles", "organs", "vessels", "nerves"];

export function systemToLayer(system: string): LayerKey | null {
  // joints are hotspots rendered with organs layer
  if (system === "joints") return "organs";
  if (LAYER_KEYS.includes(system as LayerKey)) return system as LayerKey;
  return null;
}

export function structureFor(key: string) {
  return getStructure(key);
}

export function structureLabel(key: string): string {
  const s = getStructure(key);
  return s ? s.label : key;
}

export function systemLabel(system: string): string {
  // fallback
  return system;
}

export function atLeastOneLayer(layers: Record<LayerKey, boolean>): boolean {
  return LAYER_KEYS.some((k) => layers[k]);
}

export function toggleLayer(layers: Record<LayerKey, boolean>, key: LayerKey): Record<LayerKey, boolean> {
  const next = { ...layers };
  if (next[key] && LAYER_KEYS.filter((k) => next[k]).length <= 1) return layers; // keep at least one
  next[key] = !next[key];
  return next;
}