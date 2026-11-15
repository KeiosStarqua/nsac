import { GO_CATALOG } from "./goCatalog";

/**
 * Picker shape used by /admin for both providers (id, display name, context window, prices).
 * Structurally identical to `CatalogModel` in `runtime/openrouter.server.ts` — duplicated on
 * purpose so client bundles never touch the server-only OpenRouter runtime module.
 */
export type PickerModel = {
  id: string;
  name: string;
  contextLength: number | null;
  /** USD per token (raw string from OpenRouter; derived from $/MTok for the Go snapshot). */
  prompt: string | null;
  completion: string | null;
  /** Unix seconds; null for the Go snapshot (no creation date in the SDK catalog). */
  created: number | null;
};

/** OpenCode Go snapshot → picker models (prices as $/token; `$/MTok = value × 1e6`). */
export function goAsPickerModels(): PickerModel[] {
  return GO_CATALOG.map((m) => ({
    id: m.id,
    name: m.name,
    contextLength: m.contextWindow,
    prompt: String(m.inputCostPerMTok / 1e6),
    completion: String(m.outputCostPerMTok / 1e6),
    created: null,
  }));
}
