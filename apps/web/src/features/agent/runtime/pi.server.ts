import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readOpenCodeKey } from "./opencode-key.server";
import { readBedrockKey } from "./bedrock-key.server";

// Re-exported with the signature intact — every existing import site keeps working.
export { readOpenCodeKey, readBedrockKey };

export function readOpenRouterKey(): string | null {
  const raw = process.env.SKY_OPENROUTER_API_KEY;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return raw.trim();
}

export function readProviderKey(provider: "opencode-go" | "openrouter" | "amazon-bedrock"): string | null {
  if (provider === "opencode-go") return readOpenCodeKey();
  if (provider === "amazon-bedrock") return readBedrockKey();
  return readOpenRouterKey();
}

/** Bedrock runtime baseUrl: SKY_BEDROCK_BASE_URL override, else ap-southeast-1 (independent of AWS_REGION). */
export function bedrockBaseUrl(): string {
  return process.env.SKY_BEDROCK_BASE_URL?.trim() || "https://bedrock-runtime.ap-southeast-1.amazonaws.com";
}

/** Key của provider đang hiệu lực; chỉ dùng cho check nhanh (vd. missing_key trước khi vào turn). */
export async function readAgentKey(): Promise<string | null> {
  return readProviderKey(await currentAgentProvider());
}

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { AgentProfile } from "../agents/types";
import { assistantText, isProviderError } from "../model/provider-result";
import { currentAgentModel, currentAgentProvider } from "./agent-model.server";

type PiSdk = any;

let sdkPromise: Promise<PiSdk> | null = null;
function loadPiSdk(): Promise<PiSdk> {
  sdkPromise ??= import("@earendil-works/pi-coding-agent") as unknown as Promise<PiSdk>;
  return sdkPromise;
}

let cacheDir: string | null = null;
function piCacheDir(): string {
  cacheDir ??= join(tmpdir(), `nsac-pi-models-${process.pid}`);
  mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
  return cacheDir;
}

// A Sky chat reply is at most a few short sentences; cap generation instead of
// inheriting the catalog default max output tokens.
const SKY_MAX_TOKENS = 2048;

type ModelsFileParts = {
  provider: "opencode-go" | "openrouter" | "amazon-bedrock";
  model: string;
  withModelEntry: boolean;
  maxTokens?: number;
  baseUrl?: string;
};

function ensureModelsFile(parts: ModelsFileParts): string {
  const hash = createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
  const path = join(piCacheDir(), `models-${hash}.json`);
  if (!existsSync(path)) {
    const provider: Record<string, unknown> = {};
    if (parts.baseUrl) provider.baseUrl = parts.baseUrl;
    if (parts.withModelEntry) provider.models = [{ id: parts.model, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, ...(parts.maxTokens !== undefined ? { maxTokens: parts.maxTokens } : {}) }];
    else if (parts.maxTokens !== undefined) provider.modelOverrides = { [parts.model]: { maxTokens: parts.maxTokens } };
    const payload = Object.keys(provider).length > 0
      ? { providers: { [parts.provider]: provider } }
      : { providers: {} };
    writeFileSync(path, JSON.stringify(payload), { mode: 0o600 });
  }
  return path;
}

export type SessionFacade = {
  prompt: (text: string, opts: { onDelta?: (d: string) => void; signal?: AbortSignal }) => Promise<string>;
  dispose: () => void;
};

/**
 * Tool call outcome captured from the SDK's `tool_execution_end` event. Name/ok/ms only —
 * tool arguments never land in artifacts (and from there never in traces or logs).
 */
export type ToolOutcome = { name: string; ok: boolean; ms?: number };

/**
 * Per-turn side effects a tool may produce. `prompt()` clears them when the turn starts, so a turn
 * can only report what its own tool calls did; the chat pipeline reads them once the reply settles.
 */
export type TurnArtifacts = { hudProgram?: string; tools?: ToolOutcome[] };

export async function createSession(
  profile: AgentProfile,
  ctx?: { request?: string } & Record<string, unknown>,
  overrides?: { sessionManager?: unknown; promptSuffix?: string; customTools?: ToolDefinition[]; artifacts?: TurnArtifacts },
): Promise<SessionFacade> {
  const provider = await currentAgentProvider();
  const key = readProviderKey(provider);
  if (!key) throw new Error("missing_key");
  // Model resolution: backend agent.models[profile] → legacy agent.model → env → provider default.
  const model = await currentAgentModel(profile?.id);
  // Bedrock is pinned to ap-southeast-1 unless SKY_BEDROCK_BASE_URL overrides it (never derived from AWS_REGION).
  const baseUrl =
    (provider === "opencode-go"
      ? process.env.SKY_OPENCODE_BASE_URL?.trim()
      : provider === "openrouter"
        ? process.env.SKY_OPENROUTER_BASE_URL?.trim()
        : bedrockBaseUrl()) || undefined;
  const pi = await loadPiSdk();
  const probePath = ensureModelsFile({ provider, model, withModelEntry: false, baseUrl });
  const probe = await pi.ModelRuntime.create({ modelsPath: probePath, authPath: join(piCacheDir(), "auth.json") });
  const known = !!probe.getModel(provider, model);
  // Cap maxTokens either way; modelOverrides keeps the catalog entry intact, while an
  // unknown model needs a full entry (metrics probed above).
  const modelsPath = known
    ? ensureModelsFile({ provider, model, withModelEntry: false, maxTokens: SKY_MAX_TOKENS, baseUrl })
    : ensureModelsFile({ provider, model, withModelEntry: true, maxTokens: SKY_MAX_TOKENS, baseUrl });
  const modelRuntime = await pi.ModelRuntime.create({ modelsPath, authPath: join(piCacheDir(), "auth.json") });
  const modelObj = modelRuntime.getModel(provider, model);
  if (!modelObj) throw new Error("unavailable");
  await modelRuntime.setRuntimeApiKey(provider, key);

  const settingsManager = pi.SettingsManager.inMemory({ retry: { enabled: false }, cacheWarming: "off" });
  const sessionManager = (overrides?.sessionManager as any) ?? pi.SessionManager.inMemory();
  const resourceLoader = new pi.DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: piCacheDir(),
    settingsManager,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => {
      const base = profile.systemPrompt({ request: (ctx?.request as string) ?? "", ...(ctx ?? {}) } as any);
      return overrides?.promptSuffix ? `${base}\n${overrides.promptSuffix}` : base;
    },
    appendSystemPromptOverride: () => [],
  });
  await resourceLoader.reload();

  // `tools` is an allowlist in the SDK, and custom tools are filtered against it too. The default
  // stays empty (no tools at all); only the chat session registers one, and it is named here.
  const customTools: ToolDefinition[] = overrides?.customTools ?? [];
  const { session } = await pi.createAgentSession({
    model: modelObj,
    modelRuntime,
    resourceLoader,
    sessionManager,
    settingsManager,
    cwd: process.cwd(),
    tools: customTools.map((tool) => tool.name),
    customTools,
  });

  let disposed = false;
  const abortSession = (s: any) => {
    try {
      void Promise.resolve(s.abort?.()).catch(() => {});
    } catch {
      // abort is best-effort: the caller already lost the race
    }
  };
  return {
    async prompt(text, opts) {
      // Turn artifacts belong to the turn that produces them: clearing at the start keeps a stale
      // program from a previous turn out of this turn's reply.
      if (overrides?.artifacts) delete overrides.artifacts.hudProgram;
      if (overrides?.artifacts) delete overrides.artifacts.tools;
      let total = "";
      let turnError: string | null = null;
      const unsub = session.subscribe((event: any) => {
        if (event.type === "message_update") {
          const e = event.assistantMessageEvent;
          if (e?.type === "text_delta" && typeof e.delta === "string") {
            total += e.delta;
            opts.onDelta?.(e.delta);
          } else if (e?.type === "error") {
            turnError = e.error?.errorMessage ?? e.error?.stopReason ?? e.reason ?? "error";
          }
        } else if (event.type === "tool_execution_end") {
          // Real SDK events (verified in pi-coding-agent dist/core/extensions/types.d.ts):
          // tool_execution_end carries toolName/isError/durationMs. Arguments are ignored on purpose.
          const artifacts = overrides?.artifacts;
          if (artifacts) {
            const name = typeof event.toolName === "string" ? event.toolName.slice(0, 64) : "unknown";
            const ms =
              typeof event.durationMs === "number" && Number.isFinite(event.durationMs)
                ? Math.max(0, Math.round(event.durationMs))
                : undefined;
            const arr = (artifacts.tools ??= []);
            if (arr.length < 20) {
              arr.push({ name, ok: event.isError !== true, ...(ms !== undefined ? { ms } : {}) });
            }
          }
        } else if (event.type === "message_end") {
          const m = event.message;
          if (m?.role === "assistant" && (m.stopReason === "error" || m.stopReason === "aborted")) {
            turnError = m.errorMessage ?? m.stopReason;
          }
        }
      });
      // `opts.signal` is the caller's wall-clock budget (and, from the SSE route, a disconnected
      // browser). Without wiring it the abort only lost a race while generation kept burning tokens.
      const onAbort = () => abortSession(session);
      if (opts.signal?.aborted) onAbort();
      else opts.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        await session.prompt(text);
      } finally {
        unsub();
        opts.signal?.removeEventListener("abort", onAbort);
      }
      // The SDK resolves prompt() normally even when the turn fails (e.g. provider 402);
      // an empty accumulated reply is never a successful answer. Deltas can be lost while
      // the final assistant message still carries text — recover it before throwing.
      if (turnError) {
        console.warn("agent turn failed", String(turnError).slice(0, 200));
        throw new Error(turnError);
      }
      if (total.trim() === "") {
        const last = (session as any).messages?.at(-1);
        const recovered = last?.role === "assistant" && !isProviderError(last) ? assistantText(last).trim() : "";
        if (recovered) return recovered;
        throw new Error("empty_reply");
      }
      return total;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      session.dispose();
    },
  };
}
