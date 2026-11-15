/** Pure helpers to scope model selections to a provider catalog. No React. */

export type CatalogEntry = { id: string };

export function filterModelIds(
  catalog: readonly CatalogEntry[],
  ids: readonly (string | null | undefined)[],
): { kept: string[]; dropped: string[] } {
  const idSet = new Set(catalog.map((m) => m.id));
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const raw of ids) {
    if (raw == null) continue;
    const v = String(raw).trim();
    if (v === "") continue;
    if (idSet.has(v)) kept.push(v);
    else dropped.push(v);
  }
  return { kept, dropped };
}

export function sanitizeProfileModels(
  catalog: readonly CatalogEntry[],
  models: Record<string, string>,
): { models: Record<string, string>; dropped: number } {
  const idSet = new Set(catalog.map((m) => m.id));
  const out: Record<string, string> = {};
  let dropped = 0;
  for (const [k, v] of Object.entries(models)) {
    if (v == null) continue;
    const val = String(v).trim();
    if (val === "") {
      out[k] = val;
      continue;
    }
    if (idSet.has(val)) out[k] = val;
    else dropped += 1;
  }
  return { models: out, dropped };
}