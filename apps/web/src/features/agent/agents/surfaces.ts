// Named surfaces with their OpenUI allow-lists. This list is the contract
// until the OpenUI catalog returns; adding a surface is a one-line change.
export type Surface = { readonly id: string; readonly allowList: readonly string[]; readonly purpose: string };

export const SURFACES: Readonly<Record<string, Surface>> = {
  "orbit-panel": {
    id: "orbit-panel",
    allowList: ["Panel", "Heading", "Metric", "Note", "Action"],
    purpose: "Orbital HUD panel composed by the generative UI specialist.",
  },
};

export function getSurface(id: string): Surface | null {
  return SURFACES[id] ?? null;
}
