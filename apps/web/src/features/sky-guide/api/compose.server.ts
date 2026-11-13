// Server-only: imported only from compose.functions.ts handlers. The marker import makes the build fail
// loudly if this file ever ends up in the client bundle.
import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCopy, type Locale } from "~/shared/i18n";
import { FACT_IDS, STATION_FACTS, type StationId } from "~/shared/sky";
import { skyLibrary } from "../catalog/library";
import { MAX_PROGRAM_CHARS } from "../model/program";
import { readOpenRouterKey } from "./key.server";

/** What the browser receives while a panel is composed. */
export type ComposeEvent =
  | { readonly kind: "chunk"; readonly text: string }
  | { readonly kind: "end" }
  /** No usable stream: the model could not be reached, rejected the key, or the answer broke. The preset stays. */
  | { readonly kind: "unavailable" }
  /** No OpenRouter key is saved on this machine; the browser shows the dialog asking for one. */
  | { readonly kind: "missing_key" };

// Sky's composer runs on the PI SDK (@earendil-works/pi-coding-agent) with an OpenRouter model — the same
// path as the kirector agent. Set SKY_OPENROUTER_MODEL to any OpenRouter id, SKY_OPENROUTER_BASE_URL to an
// OpenAI-compatible `/v1` base (smoke tests, proxies). Without a saved key the demo falls back to the preset.
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
const BASE_URL = process.env.SKY_OPENROUTER_BASE_URL?.trim() || undefined;
/** Whole request, first byte to last. A panel that takes longer than this is not worth the wait. */
const TIMEOUT_MS = 45_000;
/** A no-tool panel finishes in one turn; this only stops a runaway loop. */
const MAX_STEPS = 4;

function modelId(): string {
  return process.env.SKY_OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

function systemPrompt(station: StationId, locale: Locale): string {
  const copy = getCopy(locale);
  const allowed = STATION_FACTS[station];
  const language = locale === "vi" ? "Vietnamese" : "English";

  return skyLibrary.prompt({
    preamble: [
      "You are Sky, an offline clinical assistant that flies beside astronauts and flight surgeons.",
      "You just landed on one part of a website and compose a small panel about it in OpenUI Lang.",
      "Output only the OpenUI Lang program: no Markdown, no code fences, no commentary.",
    ].join(" "),
    additionalRules: [
      `Write every text in ${language}. Speak as Sky, in the first person, warm and brief.`,
      "Never write a digit in any text. Numbers reach the panel only through Fact.",
      allowed.length > 0
        ? `Fact ids allowed here: ${allowed.join(", ")}. Never use the others (${FACT_IDS.filter((id) => !allowed.includes(id)).join(", ")}).`
        : "Do not use Fact here.",
      "Do not diagnose, do not give medical advice, and do not invent actions. The crew confirms every action.",
      "Fill Console with two to five Card children, and give each Card two to five children of its own.",
    ],
    examples: [copy.sky.stations[station].preset],
  });
}

/** The slice of the PI SDK this module uses; the package is imported lazily, like in kirector. */
type PiSdk = {
  createAgentSession: (options: Record<string, unknown>) => Promise<{ session: PiSession }>;
  ModelRuntime: { create(options?: { modelsPath?: string; authPath?: string }): Promise<PiModelRuntime> };
  DefaultResourceLoader: new (options: Record<string, unknown>) => { reload(): Promise<void> };
  SessionManager: { inMemory(): unknown };
  SettingsManager: { inMemory(settings?: Record<string, unknown>): unknown };
};
interface PiAssistantMessage { role: string; stopReason?: string; errorMessage?: string }
interface PiSession {
  subscribe(listener: (event: PiSessionEvent) => void): () => void;
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  dispose(): void;
}
interface PiModelRuntime {
  getModel(provider: string, modelId: string): { id: string; api: string; provider: string } | undefined;
  setRuntimeApiKey(provider: string, apiKey: string): Promise<void>;
}
type PiSessionEvent =
  | { type: "message_update"; assistantMessageEvent: { type: string; delta?: unknown; error?: PiAssistantMessage } }
  | { type: "message_end"; message: PiAssistantMessage }
  | { type: "turn_end"; message: PiAssistantMessage };

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

/** Writes the `models.json` for one combination, once per process. `withModelEntry` adds an id missing from PI's catalog. */
function ensureModelsFile(parts: { model: string; withModelEntry: boolean }): string {
  const hash = createHash("sha256").update(JSON.stringify({ ...parts, baseUrl: BASE_URL })).digest("hex").slice(0, 16);
  const path = join(piCacheDir(), `models-${hash}.json`);
  if (!existsSync(path)) {
    const provider: Record<string, unknown> = {};
    if (BASE_URL) provider.baseUrl = BASE_URL;
    if (parts.withModelEntry) provider.models = [{ id: parts.model, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }];
    // An empty provider object is rejected by PI's composeModelProvider, so a catalog model with no overrides leaves the provider out entirely.
    const payload = Object.keys(provider).length > 0 ? { providers: { openrouter: provider } } : { providers: {} };
    writeFileSync(path, JSON.stringify(payload), { mode: 0o600 });
  }
  return path;
}

/**
 * Streams the model's OpenUI Lang for one station, or a single `unavailable` / `missing_key`.
 * `ask` is the viewer's free text from the Ask Sky panel; it is folded into the prompt, not the system
 * prompt. A malicious ask can steer the answer, so the output goes through exactly the same review as
 * any other panel (`reviewProgram`: parse, digits, fact allow-list) and anything else falls back to the preset.
 */
export async function* composeStation(station: StationId, locale: Locale, ask?: string): AsyncGenerator<ComposeEvent> {
  const key = readOpenRouterKey();
  if (key === null) {
    yield { kind: "missing_key" };
    return;
  }

  const model = modelId();
  const authPath = join(piCacheDir(), "auth.json");
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const pi = await loadPiSdk();
    // Two loads of the same registry: a plain one to learn whether the id is in PI's catalog, then the one the session runs on.
    const probePath = ensureModelsFile({ model, withModelEntry: false });
    const probe = await pi.ModelRuntime.create({ modelsPath: probePath, authPath });
    const modelsPath = probe.getModel("openrouter", model)
      ? probePath
      : ensureModelsFile({ model, withModelEntry: true });
    const modelRuntime = await pi.ModelRuntime.create({ modelsPath, authPath });
    const modelObj = modelRuntime.getModel("openrouter", model);
    if (!modelObj) {
      console.info("[sky] compose: model is not available to PI", model);
      yield { kind: "unavailable" };
      return;
    }
    await modelRuntime.setRuntimeApiKey("openrouter", key);

    const settingsManager = pi.SettingsManager.inMemory({ retry: { enabled: false }, cacheWarming: "off" });
    const sessionManager = pi.SessionManager.inMemory();
    const resourceLoader = new pi.DefaultResourceLoader({
      cwd: process.cwd(),
      agentDir: piCacheDir(),
      settingsManager,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
      systemPromptOverride: () => systemPrompt(station, locale),
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
      // Sky's composer exposes no tools; PI's built-ins (read/bash/edit/write) stay out.
      tools: [],
      customTools: [],
    });

    const queue: ComposeEvent[] = [];
    let finished = false;
    let failed: string | null = null;
    let steps = 0;
    let total = 0;
    let wake: () => void = () => {};
    const notify = () => {
      const w = wake;
      wake = () => {};
      w();
    };
    const push = (event: ComposeEvent) => {
      queue.push(event);
      notify();
    };
    const unsubscribe = session.subscribe((event) => {
      if (event.type === "message_update") {
        const e = event.assistantMessageEvent;
        if (e.type === "text_delta" && typeof e.delta === "string") {
          total += e.delta.length;
          if (total > MAX_PROGRAM_CHARS * 2) {
            failed ??= "answer too long";
            void session.abort();
            return;
          }
          push({ kind: "chunk", text: e.delta });
          return;
        }
        if (e.type === "error") failed ??= e.error?.errorMessage ?? "the model call failed";
        return;
      }
      if (event.type === "message_end") {
        const m = event.message;
        if (m?.role === "assistant" && m.stopReason === "error") failed ??= m.errorMessage ?? "the model call failed";
        return;
      }
      if (event.type === "turn_end") {
        steps += 1;
        if (steps >= MAX_STEPS) void session.abort();
      }
    });
    const onAbort = () => void session.abort();
    abort.signal.addEventListener("abort", onAbort, { once: true });
    try {
      const brief = getCopy(locale).sky.stations[station].brief;
      const viewerAsk = ask?.trim();
      const instruction = viewerAsk
        ? `${brief}\n\nThe viewer just asked: """${viewerAsk}""". Compose the panel to answer that, staying inside every rule above.`
        : brief;
      await session.prompt(instruction);
    } catch (e) {
      failed ??= e instanceof Error ? e.message : "the model call failed";
    } finally {
      abort.signal.removeEventListener("abort", onAbort);
      finished = true;
      notify();
    }
    for (;;) {
      while (queue.length > 0) {
        const event = queue.shift()!;
        if (event.kind === "chunk") yield event;
      }
      if (finished) break;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
    unsubscribe();
    session.dispose();
    if (abort.signal.aborted) {
      console.info("[sky] compose: timed out");
      yield { kind: "unavailable" };
      return;
    }
    if (failed) {
      console.info("[sky] compose: model failed:", failed.slice(0, 200));
      yield { kind: "unavailable" };
      return;
    }
    yield { kind: "end" };
  } catch (e) {
    console.info("[sky] compose: failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    yield { kind: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
