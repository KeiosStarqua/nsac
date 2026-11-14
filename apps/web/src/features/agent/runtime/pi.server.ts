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

function ensureModelsFile(parts: { model: string; withModelEntry: boolean; baseUrl?: string }): string {
  const hash = createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
  const path = join(piCacheDir(), `models-${hash}.json`);
  if (!existsSync(path)) {
    const provider: Record<string, unknown> = {};
    if (parts.baseUrl) provider.baseUrl = parts.baseUrl;
    if (parts.withModelEntry) provider.models = [{ id: parts.model, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }];
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
  const modelsPath = probe.getModel("openrouter", model) ? probePath : ensureModelsFile({ model, withModelEntry: true, baseUrl });
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
      const unsub = session.subscribe((event: any) => {
        if (event.type === "message_update") {
          const e = event.assistantMessageEvent;
          if (e?.type === "text_delta" && typeof e.delta === "string") {
            total += e.delta;
            opts.onDelta?.(e.delta);
          }
        }
      });
      await session.prompt(text);
      unsub();
      return total;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      session.dispose();
    },
  };
}