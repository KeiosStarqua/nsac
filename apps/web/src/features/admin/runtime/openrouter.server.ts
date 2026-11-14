import "@tanstack/react-start/server-only";

/** Subset of the OpenRouter `/api/v1/models` entry the admin picker needs. */
export type CatalogModel = {
  id: string;
  name: string;
  contextLength: number | null;
  /** USD per token, raw string from OpenRouter ("0" = free). */
  prompt: string | null;
  completion: string | null;
  /** Unix seconds. */
  created: number | null;
};

/**
 * `GET https://openrouter.ai/api/v1/models` — public, no API key. 5s timeout.
 * Throws on network/HTTP failure; callers turn that into a UI state.
 */
export async function fetchOpenRouterCatalog(timeoutMs = 5000): Promise<CatalogModel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`catalog_http_${res.status}`);
    const json: unknown = await res.json();
    const data = Array.isArray((json as { data?: unknown })?.data)
      ? ((json as { data: unknown[] }).data as Array<Record<string, unknown>>)
      : [];
    const models: CatalogModel[] = [];
    for (const m of data) {
      if (!m || typeof m !== "object") continue;
      const id = typeof m.id === "string" ? m.id.trim() : "";
      if (!id) continue;
      const pricing = (m.pricing ?? {}) as Record<string, unknown>;
      models.push({
        id,
        name: typeof m.name === "string" && m.name.trim() ? m.name : id,
        contextLength: typeof m.context_length === "number" ? m.context_length : null,
        prompt: typeof pricing.prompt === "string" ? pricing.prompt : null,
        completion: typeof pricing.completion === "string" ? pricing.completion : null,
        created: typeof m.created === "number" ? m.created : null,
      });
    }
    // Deterministic order for the client list; client filters anyway.
    models.sort((a, b) => a.id.localeCompare(b.id));
    return models;
  } finally {
    clearTimeout(timer);
  }
}
