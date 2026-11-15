// Pointer picking for the body map: which catalog structure is under the
// cursor, how often to report a new pointer position, and where the tooltip
// sits. Pure — no React, no three.js, no DOM — so vitest covers it.
//
// The click that selects a structure and this hover read the same hits with the
// same rule (`pickStructureKey`): skip a mesh the rail switched off, take the
// first catalog structure, and keep the skin for last because the translucent
// body shell is in front of everything.
import { getStructure } from "open-anatomy-3d";
import { shouldHidePenis } from "./genitalia";
import { structureKeyForMesh } from "./layers";

/** The parts of a raycast hit the picking rule reads (three's Intersection has both). */
export interface HoverHit {
  readonly name: string;
  readonly visible: boolean;
}

/**
 * A catalog structure under the pointer, at a viewport position (clientX /
 * clientY pixels). A touch tap pins the same shape where the finger landed.
 */
export interface HoverPoint {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

/** Pointer movement, in CSS pixels, below which a hover is not worth a re-render. */
export const HOVER_MIN_STEP = 6;

/** Distance between the finger/cursor and the tooltip box. */
export const TOOLTIP_GAP = 14;

/** Keep the tooltip this far from the viewport edge. */
export const TOOLTIP_MARGIN = 8;

/**
 * Catalog key of the structure under the cursor, or null when the pointer is
 * over uncatalogued geometry or empty space. Hidden meshes never win: a layer
 * the rail switched off, and the genitalia meshes the scene hides at load, are
 * skipped even though three's raycaster still reports them.
 */
export function pickStructureKey(hits: readonly HoverHit[]): string | null {
  let skinKey: string | null = null;
  for (const hit of hits) {
    if (!hit.visible) continue;
    if (shouldHidePenis(hit.name)) continue;
    const key = structureKeyForMesh(hit.name);
    if (!key) continue;
    if (getStructure(key)?.system === "skin") {
      skinKey ??= key;
      continue;
    }
    return key;
  }
  return skinKey;
}

/**
 * True when the tooltip has to move: a different structure, a pointer that
 * travelled far enough to be visible, or the pointer leaving the body. A tooltip
 * that only shivers one or two pixels is not worth a render.
 */
export function shouldReportHover(
  previous: HoverPoint | null,
  next: HoverPoint | null,
  step: number = HOVER_MIN_STEP,
): boolean {
  if (next === null) return previous !== null;
  if (previous === null) return true;
  if (previous.key !== next.key) return true;
  return Math.hypot(next.x - previous.x, next.y - previous.y) >= step;
}

export interface TooltipBox {
  readonly width: number;
  readonly height: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface TooltipPlacement {
  readonly left: number;
  readonly top: number;
  /** The box sits left of the pointer, because the right side had no room. */
  readonly flippedX: boolean;
  /** The box sits above the pointer, because below had no room. */
  readonly flippedY: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Where the tooltip goes for a pointer at (x, y): 14 px right and below the
 * cursor, flipped to the other side when it would leave the viewport, then
 * clamped inside it. A viewport smaller than the box keeps the box at the
 * margin rather than off-screen.
 */
export function tooltipPlacement(
  pointerX: number,
  pointerY: number,
  viewport: ViewportSize,
  box: TooltipBox,
  gap: number = TOOLTIP_GAP,
  margin: number = TOOLTIP_MARGIN,
): TooltipPlacement {
  const flippedX = pointerX + gap + box.width > viewport.width - margin && pointerX - gap - box.width >= margin;
  const left = clamp(flippedX ? pointerX - gap - box.width : pointerX + gap, margin, viewport.width - box.width - margin);
  const flippedY = pointerY + gap + box.height > viewport.height - margin && pointerY - gap - box.height >= margin;
  const top = clamp(flippedY ? pointerY - gap - box.height : pointerY + gap, margin, viewport.height - box.height - margin);
  return { left, top, flippedX, flippedY };
}
