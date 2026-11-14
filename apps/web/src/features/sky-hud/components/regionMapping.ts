export const REGION_ORDER = ["head", "chest", "arm", "leg"] as const;

export function regionLabelKey(id: string): "head" | "chest" | "arms" | "legs" {
  if (id === "head") return "head";
  if (id === "chest") return "chest";
  if (id === "arm") return "arms";
  return "legs";
}