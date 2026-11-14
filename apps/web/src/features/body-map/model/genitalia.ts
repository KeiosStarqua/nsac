// Genitalia handling for the hologram. Two pure tables, no React, no three.js,
// no DOM, so vitest can cover them.
//
// Why this is not a plain "hide these meshes" list: the male Open Anatomy asset
// (`public/models/anatomy-male.glb`, CC BY 4.0) ships ONE mesh for the whole
// male reproductive tract (`reproductive`: ductus deferens, seminal vesicles,
// penis corpora/glans, testes together) and sculpts the external genitals
// (shaft, glans, scrotum) into the single `skin` mesh (`skin_1` after the
// loader renames the duplicate node). The skin is one continuous surface
// welded into the body shell, so the bulge cannot be hidden by name nor
// deleted without leaving a hole. Measured on the real GLB (2026-11-15): the
// penis tip reaches z = 0.1049 while the pubic surface behind it sits at
// z ~0.045-0.05, and 607-674 skin vertices lie in that bulge.
//
// So: the organ mesh is hidden, and the skin's pubic bulge is flattened back
// onto the pubic plane at load time (`flattenPubis`). Nothing is deleted, the
// CC BY asset stays byte-identical, and the effect is a scene-graph transform
// that disappears with the clone.
import type { Vec3Tuple } from "./framing";

/** Mesh names hidden in the body scene, whatever layer the rail shows. */
export const HIDDEN_GENITALIA_MESHES: readonly string[] = Object.freeze(["reproductive"]);

/** Meshes whose pubic bulge is flattened (the skin, under both name spellings). */
export const PUBIS_MESHES: readonly string[] = Object.freeze(["skin_1", "skin"]);

/**
 * The pubic bulge of the male skin mesh, in model world metres (the GLB is
 * ~1.72 m tall, +y up, +z forward). `plane` is the pubic surface the bulge is
 * pressed back onto; `core` is the fraction of the radii at full strength,
 * with a linear falloff to the region edge so the patch blends in.
 */
export const PUBIS_REGION: {
  readonly center: Vec3Tuple;
  readonly radii: Vec3Tuple;
  readonly plane: number;
  readonly core: number;
} = Object.freeze({
  center: [0, 0.815, 0.02] as Vec3Tuple,
  radii: [0.075, 0.09, 0.13] as Vec3Tuple,
  plane: 0.045,
  core: 0.75,
});

// The asset names meshes in lowercase snake_case with no spaces (`skin`,
// `lung_l`, `reproductive`); normalising keeps the table robust to an asset
// that spells the same mesh `Reproductive` or `reproductive system`.
function normalizeMeshName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function inTable(table: readonly string[], name: string): boolean {
  const normalized = normalizeMeshName(name);
  if (normalized.length === 0) return false;
  return table.some((entry) => normalizeMeshName(entry) === normalized);
}

/** True when the glTF mesh name must stay hidden in the scene. */
export function shouldHidePenis(name: string): boolean {
  return inTable(HIDDEN_GENITALIA_MESHES, name);
}

/** True when the mesh's pubic bulge is flattened at load time. */
export function isPubisMesh(name: string): boolean {
  return inTable(PUBIS_MESHES, name);
}

/** Strength of the flatten at a world point: 1 in the core, 0 outside the region. */
export function pubisWeight(x: number, y: number, z: number): number {
  const { center, radii, core } = PUBIS_REGION;
  const dx = (x - center[0]) / radii[0];
  const dy = (y - center[1]) / radii[1];
  const dz = (z - center[2]) / radii[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance >= 1) return 0;
  if (distance <= core) return 1;
  return 1 - (distance - core) / (1 - core);
}

/**
 * Flatten the pubic protrusion: a point inside the region is pulled back (only
 * backwards, never forwards) towards the pubic plane, by the region weight.
 * Points outside the region, and points already behind the plane, are returned
 * unchanged, so the rest of the body keeps its shape.
 */
export function flattenPubis([x, y, z]: Vec3Tuple): Vec3Tuple {
  const weight = pubisWeight(x, y, z);
  if (weight === 0) return [x, y, z];
  const target = Math.min(z, PUBIS_REGION.plane);
  if (target === z) return [x, y, z];
  return [x, y, z + (target - z) * weight];
}
