/** Local-only. Nothing here talks to a cloud model. */
export function ollamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/+$/, "");
}

export function ollamaModelName(): string {
  return process.env.OLLAMA_MODEL ?? "qwen3:8b";
}

/**
 * Mastra talks to Ollama through its OpenAI-compatible endpoint (/v1).
 * Ollama ignores the API key, but the OpenAI client wants a non-empty one.
 */
export function healthModel() {
  return {
    id: `ollama/${ollamaModelName()}` as const,
    url: `${ollamaBaseUrl()}/v1`,
    apiKey: "ollama",
  };
}

export interface OllamaStatus {
  online: boolean;
  model: string;
  modelInstalled: boolean;
}

/** Quick probe so the UI can say "AI offline, showing the built-in briefing" instead of failing. */
export async function ollamaStatus(timeoutMs = 800): Promise<OllamaStatus> {
  const model = ollamaModelName();
  try {
    const res = await fetch(`${ollamaBaseUrl()}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { online: false, model, modelInstalled: false };
    const body = (await res.json()) as { models?: Array<{ name?: string }> };
    const installed = (body.models ?? []).some((m) => m.name === model || m.name?.startsWith(`${model}:`));
    return { online: true, model, modelInstalled: installed };
  } catch {
    return { online: false, model, modelInstalled: false };
  }
}
