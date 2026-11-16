import "@tanstack/react-start/server-only";
import type { AgentProvider } from "../runtime/agent-model.server";
import { readBedrockKey } from "../runtime/bedrock-key.server";
import { readOpenCodeKey } from "../runtime/opencode-key.server";
import { readOpenRouterKey } from "../runtime/openrouter-key.server";

/**
 * Provider → Mastra model mapping (dual-core, HARNESSING §18).
 *
 * Mastra's model router takes either a magic id (`provider/model`) or an explicit
 * OpenAI-compatible endpoint (`{ id, url, apiKey }`). Both of our OpenAI-wire providers use the
 * endpoint form so the key never has to be exported as an env var for Mastra to find: it is passed
 * per session, read from the same places the pi core reads (`readOpenCodeKey` / `readOpenRouterKey`
 * / `readBedrockKey`) — env or the write-only `var/sky-*.json` store.
 *
 * - `opencode-go` → `<base>/openai/v1` (the OpenAI-compatible base, NOT `/chat/completions`).
 *   The id stays `opencode-go/<model>` (direct-provider routing form, docs "Use local models with
 *   Mastra"): the wire model name is the bare catalog id, e.g. `deepseek-v4.1-flash`.
 * - `openrouter` → `https://openrouter.ai/api/v1` — the same base pi-ai uses
 *   (`@earendil-works/pi-ai/dist/providers/openrouter.js` → `OPENROUTER_BASE_URL`). OpenRouter is a
 *   gateway whose model ids are themselves `vendor/model`, so the id is the triple form
 *   `openrouter/<vendor>/<model>`.
 * - `amazon-bedrock` → NOT in Mastra's model router (verified against 1.83.0: no bedrock provider
 *   entry on the router). Use the AI SDK provider module `@ai-sdk/amazon-bedrock`, whose
 *   `apiKey` option is the `AWS_BEARER_TOKEN_BEDROCK` bearer token (verified in
 *   `node_modules/@ai-sdk/amazon-bedrock/dist/index.d.ts`: "When `apiKey` is provided, it takes
 *   precedence over AWS SigV4 authentication"). Region is pinned to ap-southeast-1 — same rule as
 *   the pi core; `AWS_REGION` is deliberately ignored.
 *
 * No key is ever read from the environment by Mastra itself: every key in this module comes from an
 * explicit argument or from the pi core's readers, and never leaves the process.
 */

/** Sky replies are a few short sentences; cap generation instead of inheriting a catalog default. */
export const MASTRA_MAX_OUTPUT_TOKENS = 2048;

/** Bedrock region is pinned (same rule as the pi core: `AWS_REGION` is not consulted). */
export const MASTRA_BEDROCK_REGION = "ap-southeast-1";

const DEFAULT_OPENCODE_GO_BASE_URL = "https://opencode.ai/inference/go/openai/v1";
// Same default as pi-ai's openrouter provider (`OPENROUTER_BASE_URL` in @earendil-works/pi-ai).
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export type MastraModelKeys = {
  opencodeGo: string | null;
  openrouter: string | null;
  bedrock: string | null;
};

/**
 * Endpoint form of a Mastra model that needs no package import. Kept as plain data (not a Mastra
 * type) so the mapping is unit-testable without loading the runtime.
 */
export type OpenAICompatibleModelSpec = {
  kind: "openai-compatible";
  /** Routing id: `opencode-go/<model>` | `openrouter/<vendor>/<model>`. */
  id: string;
  /** OpenAI-compatible base URL (`/v1`), never the `/chat/completions` path. */
  url: string;
  apiKey: string;
};

/** Native Bedrock goes through the AI SDK provider module. */
export type BedrockModelSpec = {
  kind: "bedrock";
  /** Bedrock model / inference-profile id, e.g. `global.amazon.nova-2-lite-v1:0`. */
  modelId: string;
  apiKey: string;
  region: string;
};

export type MastraModelSpec = OpenAICompatibleModelSpec | BedrockModelSpec;

export type MastraModelResolution =
  | { ok: true; provider: AgentProvider; modelId: string; spec: MastraModelSpec }
  | { ok: false; reason: "missing_key" };

function baseUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

/** Key set from the same sources the pi core uses (env first, then the write-only file stores). */
export function readMastraModelKeys(): MastraModelKeys {
  return {
    opencodeGo: readOpenCodeKey(),
    openrouter: readOpenRouterKey(),
    bedrock: readBedrockKey(),
  };
}

/**
 * Pure mapping — provider + model + keys in, model spec out. No env read, no network, no logging
 * (a key must never reach a log line, an error message or a test snapshot).
 */
export function mastraModelSpec(input: {
  provider: AgentProvider;
  model: string;
  keys: MastraModelKeys;
  /** Test/self-host overrides mirroring the pi core's env names. */
  baseUrls?: { opencodeGo?: string; openrouter?: string };
}): MastraModelResolution {
  const { provider, model, keys, baseUrls } = input;

  if (provider === "opencode-go") {
    if (!keys.opencodeGo) return { ok: false, reason: "missing_key" };
    return {
      ok: true,
      provider,
      modelId: model,
      spec: {
        kind: "openai-compatible",
        id: `opencode-go/${model}`,
        url: baseUrl(baseUrls?.opencodeGo, DEFAULT_OPENCODE_GO_BASE_URL),
        apiKey: keys.opencodeGo,
      },
    };
  }

  if (provider === "openrouter") {
    if (!keys.openrouter) return { ok: false, reason: "missing_key" };
    return {
      ok: true,
      provider,
      modelId: model,
      // Gateway triple form: openrouter model ids already carry their vendor namespace.
      spec: {
        kind: "openai-compatible",
        id: `openrouter/${model}`,
        url: baseUrl(baseUrls?.openrouter, DEFAULT_OPENROUTER_BASE_URL),
        apiKey: keys.openrouter,
      },
    };
  }

  if (!keys.bedrock) return { ok: false, reason: "missing_key" };
  return {
    ok: true,
    provider,
    modelId: model,
    spec: { kind: "bedrock", modelId: model, apiKey: keys.bedrock, region: MASTRA_BEDROCK_REGION },
  };
}

/** Same mapping, but reading the keys from the process (env → write-only file stores). */
export function mastraModelSpecFromEnv(provider: AgentProvider, model: string): MastraModelResolution {
  return mastraModelSpec({
    provider,
    model,
    keys: readMastraModelKeys(),
    baseUrls: {
      opencodeGo: process.env.SKY_OPENCODE_BASE_URL,
      openrouter: process.env.SKY_OPENROUTER_BASE_URL,
    },
  });
}

/**
 * Materialise the spec into what `new Agent({ model })` accepts:
 * - OpenAI-compatible endpoint → the plain `{ id, url, apiKey }` config object.
 * - Bedrock → an AI SDK `LanguageModelV4` from `@ai-sdk/amazon-bedrock`, imported lazily so the
 *   provider module (and its AWS helper deps) only joins the server bundle chunk that needs it.
 */
export async function resolveMastraModel(spec: MastraModelSpec): Promise<unknown> {
  if (spec.kind === "openai-compatible") {
    return { id: spec.id, url: spec.url, apiKey: spec.apiKey };
  }
  const { createAmazonBedrock } = await import("@ai-sdk/amazon-bedrock");
  const bedrock = createAmazonBedrock({ region: spec.region, apiKey: spec.apiKey });
  return bedrock(spec.modelId);
}
