import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
export function readOpenRouterKey(): string | null {
  const raw = process.env.SKY_OPENROUTER_API_KEY;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return raw.trim();
}
import type { AgentProfile } from "../agents/types";
import { assistantText, isProviderError } from "../model/provider-result";

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

function ensureModelsFile(parts: { model: string; withModelEntry: boolean; maxTokens?: number; baseUrl?: string }): string {
  const hash = createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
  const path = join(piCacheDir(), `models-${hash}.json`);
  if (!existsSync(path)) {
    const provider: Record<string, unknown> = {};
    if (parts.baseUrl) provider.baseUrl = parts.baseUrl;
    if (parts.withModelEntry) provider.models = [{ id: parts.model, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, ...(parts.maxTokens !== undefined ? { maxTokens: parts.maxTokens } : {}) }];
    else if (parts.maxTokens !== undefined) provider.modelOverrides = { [parts.model]: { maxTokens: parts.maxTokens } };
    const payload = Object.keys(provider).length > 0 ? { providers: { openrouter: provider } } : { providers: {} };
    writeFileSync(path, JSON.stringify(payload), { mode: 0o600 });
  }
  return path;
}

export type SessionFacade = {
  prompt: (text: string, opts: { onDelta?: (d: string) => void; signal?: AbortSignal }) => Promise<string>;
  dispose: () => void;
};

export async function createSession(profile: AgentProfile, ctx?: { request?: string } & Record<string,unknown>, overrides?: { sessionManager?: unknown; promptSuffix?: string }): Promise<SessionFacade> {
  const key = readOpenRouterKey();
  if (!key) throw new Error("missing_key");
  const model = process.env[profile.modelEnv]?.trim() || profile.defaultModel;
  const baseUrl = process.env.SKY_OPENROUTER_BASE_URL?.trim() || undefined;
  const pi = await loadPiSdk();
  const probePath = ensureModelsFile({ model, withModelEntry: false, baseUrl });
  const probe = await pi.ModelRuntime.create({ modelsPath: probePath, authPath: join(piCacheDir(), "auth.json") });
  const known = !!probe.getModel("openrouter", model);
  // Cap maxTokens either way; modelOverrides keeps the catalog entry intact, while an
  // unknown model needs a full entry (metrics probed above).
  const modelsPath = known
    ? ensureModelsFile({ model, withModelEntry: false, maxTokens: SKY_MAX_TOKENS, baseUrl })
    : ensureModelsFile({ model, withModelEntry: true, maxTokens: SKY_MAX_TOKENS, baseUrl });
  const modelRuntime = await pi.ModelRuntime.create({ modelsPath, authPath: join(piCacheDir(), "auth.json") });
  const modelObj = modelRuntime.getModel("openrouter", model);
  if (!modelObj) throw new Error("unavailable");
  await modelRuntime.setRuntimeApiKey("openrouter", key);

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

  const { session } = await pi.createAgentSession({
    model: modelObj,
    modelRuntime,
    resourceLoader,
    sessionManager,
    settingsManager,
    cwd: process.cwd(),
    tools: [],
    customTools: [],
  });

  let disposed = false;
  return {
    async prompt(text, opts) {
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
        } else if (event.type === "message_end") {
          const m = event.message;
          if (m?.role === "assistant" && (m.stopReason === "error" || m.stopReason === "aborted")) {
            turnError = m.errorMessage ?? m.stopReason;
          }
        }
      });
      await session.prompt(text);
      unsub();
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