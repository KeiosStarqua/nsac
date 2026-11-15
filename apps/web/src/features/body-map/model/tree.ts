// The accessible Body Tree for the /body page: the whole catalog, grouped by
// system, for a keyboard/screen-reader list synchronized with the 3D canvas.
// Pure data only — no React, three.js or DOM — so vitest can cover it.
import { ANATOMY_STRUCTURES, SYSTEMS, SYSTEM_LABELS, type AnatomySystem } from "open-anatomy-3d";
import { VITALS_BY_KEY } from "./selection";

export interface BodyTreeItem {
  readonly key: string;
  readonly label: string;
  readonly category: string;
  readonly color: string;
  /** True iff the HUD carries a simulated reading for this key. */
  readonly simulated: boolean;
}

export interface BodyTreeGroup {
  readonly system: AnatomySystem;
  readonly systemLabel: string;
  readonly items: readonly BodyTreeItem[];
}

// The simulated-reading allowlist is the structure card's own
// (`VITALS_BY_KEY` in `model/selection.ts` — heart, lung_l, lung_r, brain), so
// the tree can never flag a structure the card would not show a reading for.
const SIMULATED_KEYS: ReadonlySet<string> = new Set(Object.keys(VITALS_BY_KEY));

// Static table built once at module load. Group order is SYSTEMS (the
// catalog's own system order, same as the rail); within a group the catalog
// order of ANATOMY_STRUCTURES is kept. Female-only structures are listed
// too — the catalog is the contract, all 147 keys appear.
const TREE: ReadonlyArray<BodyTreeGroup> = SYSTEMS.map((system) => ({
  system,
  systemLabel: SYSTEM_LABELS[system],
  items: ANATOMY_STRUCTURES.filter((structure) => structure.system === system).map((structure) => ({
    key: structure.key,
    label: structure.label,
    category: structure.category,
    color: structure.color,
    simulated: SIMULATED_KEYS.has(structure.key),
  })),
}));

export function treeBySystem(): ReadonlyArray<BodyTreeGroup> {
  return TREE;
}
