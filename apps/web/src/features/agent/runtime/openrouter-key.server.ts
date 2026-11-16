import "@tanstack/react-start/server-only";

/**
 * OpenRouter key reader. Kept in its own module so the Mastra core can read the key without
 * importing `pi.server.ts` (which registers the lazy Bedrock provider and pulls pi-ai into the
 * chunk). `pi.server.ts` re-exports this function, so every existing import site is unchanged and
 * the pi path keeps reading exactly the same env var.
 */
export function readOpenRouterKey(): string | null {
  const raw = process.env.SKY_OPENROUTER_API_KEY;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return raw.trim();
}
