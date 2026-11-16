import "@tanstack/react-start/server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Agent } from "@mastra/core/agent";
import type { WorkingMemory } from "@mastra/core/memory";
import { createTool } from "@mastra/core/tools";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import type { AgentContext, AgentProfile } from "../agents/types";
import type { SessionFacade, ToolOutcome, TurnArtifacts } from "../runtime/pi.server";
import { currentAgentModel, currentAgentProvider } from "../runtime/agent-model.server";
import {
  MASTRA_MAX_OUTPUT_TOKENS,
  mastraModelSpecFromEnv,
  resolveMastraModel,
} from "./mastra-model.server";
import { getAgent } from "../agents/registry";
import { getMastraRoot, noteMastraObservabilityFailure } from "./mastra-observability.server";
// One description, one gate — shared with the pi core. The HUD graph is already in the server graph
// (astro-chat imports the pi twin statically), so no lazy import here.
import { SHOW_HUD_DESCRIPTION, composeHudProgramForBrief } from "../runtime/hud-show.server";

/**
 * Mastra runtime behind the same seams as `runtime/pi.server.ts` (dual-core, HARNESSING §18).
 *
 * `createMastraSession(profile, ctx, overrides)` returns the same `SessionFacade` shape the pi core
 * returns, so `astro-chat.server.ts` / `run.server.ts` keep ONE pipeline after the session exists:
 * - `prompt(text, { onDelta, signal })` streams text deltas, honours the caller's AbortSignal and
 *   resolves the whole reply; failures throw (`empty_reply`, the provider message, `aborted`).
 * - `dispose()` aborts an in-flight turn and releases the memory store.
 *
 * What is Mastra-specific:
 * - Chat memory: a Mastra `Memory` on `@mastra/libsql` at `var/sky-mastra.db`
 *   (`NSAC_SKY_MASTRA_DB` override), thread + resource `astronaut:<id>` (fallback `global`) —
 *   parity with the pi core's per-astronaut session files, but stored as rows, not JSONL.
 * - Chat **working memory** (2026-11-17): `sky-chat` alone gets a resource-scoped Markdown
 *   working profile (`WORKING_MEMORY_TEMPLATE`) in the same LibSQL store, so what the astronaut
 *   stated about themselves survives beyond the replayed message window. Resource scope means
 *   the profile belongs to the crew member, not to one thread. No vector/embedding, no semantic
 *   recall, no observational memory: one Markdown row, no embeddings (Keios's choice).
 *   One-shot runners (`orchestrator`, `generative-ui`, `medical-officer`) get no memory at all,
 *   mirroring pi's `SessionManager.inMemory()` default; the HUD composer keeps its own plain
 *   thread memory (`hud:<id>`) WITHOUT a working profile — same object shape as before.
 *   Pi core is untouched: no working profile, no history import between cores.
 * - Tools: only `sky-chat` registers `show_on_hud`, built natively with `createTool` and delegating
 *   to the same `composeHudProgramForBrief` gate the pi tool uses. No other tool is ever added, and
 *   `overrides.customTools` (pi `ToolDefinition`s) is deliberately ignored — the Mastra twin is the
 *   only tool.
 * - `overrides.sessionManager` is ignored: Mastra keeps history in its memory threads, not in a pi
 *   JSONL session file.
 * - Tracing: every built agent is registered on the process-wide Mastra root
 *   (`mastra-observability.server.ts`) so its spans export to Langfuse when `LANGFUSE_*` is set.
 *   HARNESSING §18.5.
 *
 * Nothing here is constructed at import time: the Agent, the tool and the memory store are built
 * per session inside `createMastraSession`, because Nitro/vite import server modules during the
 * build and an eager DB handle would open files in the build sandbox.
 */

/**
 * Mastra ships opt-out usage telemetry (PostHog, behind `MASTRA_TELEMETRY_DISABLED`). This
 * deployment sends nothing anywhere on its own behalf, so hard-off before any Agent is built.
 */
if (!process.env.MASTRA_TELEMETRY_DISABLED) process.env.MASTRA_TELEMETRY_DISABLED = "1";

/** Chat: one tool-call step + the final text step, plus one spare step. */
const CHAT_MAX_STEPS = 3;
/**
 * One-shot runners never call tools, so a single model step is normally enough; 2 leaves room for
 * one continuation step (a provider that ends a step on an empty turn) without risking a loop —
 * there is no tool for the model to call, so a stray extra step is bounded by the caller's
 * wall-clock timeout anyway.
 */
const ONESHOT_MAX_STEPS = 2;

export function mastraMaxSteps(profileId: string): number {
  return profileId === "sky-chat" ? CHAT_MAX_STEPS : ONESHOT_MAX_STEPS;
}

/**
 * `var/sky-mastra.db` (LibSQL) — accepts a bare filesystem path, a `file:` URL or a
 * `libsql://`/`http://` URL in `NSAC_SKY_MASTRA_DB`.
 */
export function mastraDbUrl(): string {
  const raw = process.env.NSAC_SKY_MASTRA_DB?.trim();
  if (raw && raw.length > 0) {
    if (raw === ":memory:" || raw.startsWith("file:") || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
    return `file:${raw}`;
  }
  return `file:${process.cwd()}/var/sky-mastra.db`;
}

/** Thread/resource id for an astronaut — `astronaut:<id>`, `global` when the context has no id. */
export function mastraThreadId(ctx?: AgentContext): string {
  const raw = (ctx as { astronautId?: unknown } | undefined)?.astronautId;
  const id = typeof raw === "string" ? raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) : "";
  return id ? `astronaut:${id}` : "global";
}

/**
 * Working profile template for `sky-chat` — Markdown, filled and revised by the model, stored per
 * resource (crew member) in the same LibSQL store. Every line is a placeholder on purpose: the
 * profile starts empty and stays empty until the astronaut says something durable. Nothing here is
 * a medical record and nothing here authorizes an action.
 */
export const WORKING_MEMORY_TEMPLATE = `# Working profile — fictional crew member on SKY
Keep only durable facts you are confident about. Update sparingly, in the astronaut's language.

- Name / role (from the crew fixture in instructions — confirm if they differ): 
- How they want to be spoken to (language, directness, formality): 
- Baseline the astronaut has reported themselves (sleep, HR, HRV, BP, SpO2, activity) — quote what THEY said, never a number you computed; mark "(unverified)" unless they confirmed it: 
- Open items / pending confirmations (nothing is actioned without their explicit confirmation): 
- Explicit confirmations they gave this episode ("Confirmed: …") — never write one without their words containing it: 
- Follow-ups to check next session: `;

/**
 * Discipline block appended to the chat instructions (after base + promptSuffix). Keeps the model
 * from turning the profile into invented data or into an authorization to act.
 */
export const WORKING_MEMORY_INSTRUCTIONS =
  "You keep a small persistent profile of this astronaut (working memory). Update it ONLY for durable, astronaut-stated facts — preferences, confirmed baselines, open items, explicit confirmations, follow-ups. Never invent values; never write medical conclusions; never record an action or confirmation the astronaut did not say; keep entries short; when unsure, delete or leave stale prose out. The profile is context, never a medical record and never authorization to act.";

/**
 * Resource scope: the profile follows the astronaut across threads. No `lastMessages`, no
 * `semanticRecall`, no `vector` — working memory is the only Memory feature this core enables.
 */
export const CHAT_WORKING_MEMORY: WorkingMemory = {
  enabled: true,
  scope: "resource",
  template: WORKING_MEMORY_TEMPLATE,
};

type MastraStream = AsyncIterable<any> & { text?: Promise<string> };

type MastraAgentLike = {
  stream: (input: string, opts: Record<string, unknown>) => Promise<MastraStream>;
};

type MastraAgentConfig = Record<string, unknown>;

let agentFactory: ((config: MastraAgentConfig) => MastraAgentLike) | null = null;

/**
 * Test seam: build the agent from the config we would pass to `new Agent(...)` instead of loading
 * the real runtime. `null` restores the real constructor.
 */
export function setMastraAgentFactoryForTests(factory: ((config: MastraAgentConfig) => MastraAgentLike) | null): void {
  agentFactory = factory;
}

function buildAgent(config: MastraAgentConfig): MastraAgentLike {
  if (agentFactory) return agentFactory(config);
  return new Agent(config as ConstructorParameters<typeof Agent>[0]) as unknown as MastraAgentLike;
}

/**
 * One Mastra Memory per session (lazily built; never at import time). `withWorkingMemory` is true
 * for `sky-chat` only: the chat session carries the resource-scoped working profile, every other
 * stateful session (the HUD composer) keeps the plain thread memory it had before, and no Memory
 * object is ever shared between sessions.
 */
function createSessionMemory(withWorkingMemory: boolean): Memory {
  const url = mastraDbUrl();
  if (url.startsWith("file:")) {
    try {
      mkdirSync(dirname(url.slice("file:".length)), { recursive: true, mode: 0o700 });
    } catch {
      // Best effort: LibSQL reports a usable error if the directory really is missing.
    }
  }
  return new Memory({
    storage: new LibSQLStore({ id: "sky-memory", url }),
    ...(withWorkingMemory ? { options: { workingMemory: CHAT_WORKING_MEMORY } } : {}),
  });
}

/** The `show_on_hud` twin: same gate, same artifacts object, Mastra's tool wire format. */
function createMastraShowHudTool(artifacts: TurnArtifacts) {
  return createTool({
    id: "show_on_hud",
    description: SHOW_HUD_DESCRIPTION,
    inputSchema: z.object({
      brief: z.string().min(1).max(500).describe("One short sentence describing what to visualize."),
    }),
    execute: async ({ brief }) => {
      // Same turn budget as the pi tool: a cancelled turn stops the delegated composition.
      const outcome = await composeHudProgramForBrief(brief, { signal: artifacts.signal });
      if (!outcome.ok) throw new Error(outcome.message);
      artifacts.hudProgram = outcome.program;
      artifacts.chatDock = "right";
      return "HUD updated.";
    },
  });
}

type ArtifactsCarrier = { hudProgram?: string; chatDock?: "right"; tools?: ToolOutcome[] };

function recordToolOutcome(artifacts: ArtifactsCarrier | undefined, name: unknown, ok: boolean, ms?: number) {
  if (!artifacts) return;
  const label = typeof name === "string" ? name.slice(0, 64) : "unknown";
  const arr = (artifacts.tools ??= []);
  if (arr.length < 20) arr.push({ name: label, ok, ...(ms !== undefined ? { ms } : {}) });
}

/**
 * The generic `sky-chat` agent, registered ONCE on the process-wide root so scheduled fires
 * resolve the profile even before any chat turn ever ran (HARNESSING §19). Same build path and
 * same `isChat` semantics as a chat session — LibSQL-backed memory with the working profile —
 * but NO astronaut identity in the instructions and NO caller suffix: identity travels in the
 * prepared prompt at fire time, never in the registration. Per-turn sessions re-add a fresh
 * session agent under the same key (remove-then-add), so this registration is only the baseline.
 *
 * Called from inside the root builder (never at module import); resolves provider/model the
 * same way `createMastraSession` does. `null` (not a throw) when the provider has no usable key —
 * the root simply carries no sky-chat then and scheduled fires fail honestly with
 * `agent-missing` instead of a broken half-registered agent.
 */
export async function buildEagerSkyChatAgent(): Promise<Agent | null> {
  try {
    const provider = await currentAgentProvider();
    const model = await currentAgentModel("sky-chat");
    const resolved = mastraModelSpecFromEnv(provider, model);
    if (!resolved.ok) return null;
    const modelObject = await resolveMastraModel(resolved.spec);
    const profile = getAgent("sky-chat");
    const baseInstructions = profile.systemPrompt({ request: "" } as AgentContext);
    // Order mirrors createMastraSession: base first, then the working-memory discipline block
    // (chat only). No promptSuffix — there is no per-fire context at registration time.
    const instructions = [baseInstructions, WORKING_MEMORY_INSTRUCTIONS].join("\n");
    const memory = createSessionMemory(true);
    return buildAgent({
      id: profile.id,
      name: profile.name,
      instructions,
      model: modelObject,
      maxRetries: 0,
      tools: { show_on_hud: createMastraShowHudTool({}) },
      memory,
    }) as unknown as Agent;
  } catch (error) {
    console.warn(
      "[sky-schedules] eager sky-chat build failed:",
      error instanceof Error ? error.message.slice(0, 200) : "error",
    );
    return null;
  }
}

export async function createMastraSession(
  profile: AgentProfile,
  ctx?: AgentContext & Record<string, unknown>,
  overrides?: { sessionManager?: unknown; promptSuffix?: string; customTools?: unknown[]; artifacts?: TurnArtifacts; threadId?: string },
): Promise<SessionFacade> {
  // Same gate and same sentinel as the pi core: no key for the effective provider ⇒ `missing_key`.
  const provider = await currentAgentProvider();
  const model = await currentAgentModel(profile?.id);
  const resolved = mastraModelSpecFromEnv(provider, model);
  if (!resolved.ok) throw new Error("missing_key");
  const modelObject = await resolveMastraModel(resolved.spec);

  const baseInstructions = profile.systemPrompt({
    request: (ctx?.request as string) ?? "",
    ...(ctx ?? {}),
  } as AgentContext);
  const isChat = profile.id === "sky-chat";
  // Order is part of the contract: base prompt, then the caller's suffix (SHARED CONTEXT etc.),
  // then — chat only — the working-memory discipline block. The pi core never gets the last part.
  const instructions = [
    baseInstructions,
    overrides?.promptSuffix ? overrides.promptSuffix : null,
    isChat ? WORKING_MEMORY_INSTRUCTIONS : null,
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("\n");

  const artifacts = overrides?.artifacts;
  // Pi passes its custom tools through `overrides.customTools`; the Mastra core owns its own twin
  // and ignores those definitions on purpose (see the module comment).
  const tools = isChat ? { show_on_hud: createMastraShowHudTool(artifacts ?? {}) } : undefined;
  // Stateful session profiles keep their thread (chat + the per-astronaut HUD composer, which the pi
  // core gives its own `<id>.hud.jsonl`). One-shot runners get no memory, matching pi's inMemory
  // default for `runAgent` sessions. Only chat adds the working profile on top of the thread.
  const stateful = isChat || profile.id === "sky-hud-composer";
  const memory = stateful ? createSessionMemory(isChat) : undefined;
  const threadId = memory
    ? overrides?.threadId?.trim() || (isChat ? mastraThreadId(ctx) : `hud:${mastraThreadId(ctx)}`)
    : undefined;
  const maxSteps = mastraMaxSteps(profile.id);

  const agent = buildAgent({
    id: profile.id,
    name: profile.name,
    instructions,
    model: modelObject,
    // Parity with the pi core's `SettingsManager.inMemory({ retry: { enabled: false } })`: the
    // caller owns fallback, a provider failure is never silently retried (no hidden token spend).
    maxRetries: 0,
    ...(tools ? { tools } : {}),
    ...(memory ? { memory } : {}),
  });

  // Tracing (HARNESSING §18.5): register this session's agent on the process-wide Mastra root so
  // the runtime's own model/tool/step spans export to Langfuse. Gated on LANGFUSE_* AND best
  // effort — tracing off, a failed import, or a registration error must never break the turn.
  try {
    const root = await getMastraRoot();
    if (root) {
      // One registration per profile key: a newer session replaces the older agent, so a warm
      // process never trips MASTRA_ADD_AGENT_DUPLICATE_KEY on the second chat turn.
      if (typeof root.removeAgent === "function") root.removeAgent(profile.id);
      root.addAgent(agent as unknown as Agent, profile.id);
    }
  } catch (e) {
    noteMastraObservabilityFailure(e);
  }

  const controller = new AbortController();
  let disposed = false;
  return {
    async prompt(text, opts = {}) {
      if (disposed) throw new Error("session_disposed");
      // Turn artifacts belong to the turn that produces them (same rule as the pi core).
      if (artifacts) delete artifacts.hudProgram;
      if (artifacts) delete artifacts.chatDock;
      if (artifacts) delete artifacts.tools;

      const turnController = new AbortController();
      const onOuterAbort = () => turnController.abort();
      const onDisposeAbort = () => turnController.abort();
      controller.signal.addEventListener("abort", onDisposeAbort, { once: true });
      if (opts.signal?.aborted) turnController.abort();
      else opts.signal?.addEventListener("abort", onOuterAbort, { once: true });

      let total = "";
      let turnError: string | null = null;
      let aborted = false;
      // Mastra resolves `stream.text` after the run: the recovery path for a reply whose deltas
      // were lost (the pi core recovers from its last assistant message the same way).
      let streamText: Promise<string> | null = null;
      try {
        const stream = await agent.stream(text, {
          maxSteps,
          modelSettings: { maxOutputTokens: MASTRA_MAX_OUTPUT_TOKENS },
          abortSignal: turnController.signal,
          ...(threadId ? { memory: { thread: threadId, resource: threadId } } : {}),
        });
        streamText = Promise.resolve((stream as { text?: Promise<string> }).text ?? "").catch(() => "");
        // Mastra's output object exposes the chunk stream as `fullStream` (ReadableStream); the fakes
        // in tests hand back an async iterable directly, so accept both.
        const iterable = ((stream as { fullStream?: AsyncIterable<any> }).fullStream ?? stream) as AsyncIterable<any>;
        for await (const chunk of iterable) {
          if (chunk?.type === "text-delta") {
            const delta = chunk.payload?.text;
            if (typeof delta === "string" && delta.length > 0) {
              total += delta;
              opts.onDelta?.(delta);
            }
          } else if (chunk?.type === "tool-result") {
            recordToolOutcome(artifacts, chunk.payload?.toolName, chunk.payload?.isError !== true);
          } else if (chunk?.type === "tool-error") {
            recordToolOutcome(artifacts, chunk.payload?.toolName, false);
          } else if (chunk?.type === "error") {
            turnError = describeError(chunk.payload?.error);
          } else if (chunk?.type === "abort") {
            aborted = true;
          }
        }
      } catch (e) {
        turnError = (e as Error)?.message ? String((e as Error).message) : "turn_error";
      } finally {
        opts.signal?.removeEventListener("abort", onOuterAbort);
        controller.signal.removeEventListener("abort", onDisposeAbort);
      }

      if (aborted || turnController.signal.aborted || opts.signal?.aborted) throw new Error("aborted");
      if (turnError) {
        console.warn("agent turn failed", String(turnError).slice(0, 200));
        throw new Error(turnError);
      }
      if (total.trim() === "") {
        // Deltas can be lost while the final assistant text still exists — recover it first.
        const recovered = streamText ? (await streamText).trim() : "";
        if (recovered) return recovered;
        throw new Error("empty_reply");
      }
      return total;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      const store = (memory as unknown as { storage?: { settled?: () => Promise<void>; close?: () => Promise<void> } } | undefined)
        ?.storage;
      // Fire-and-forget: settle pending memory work, then close the LibSQL connection. Never throws.
      void Promise.resolve(store?.settled?.())
        .then(() => store?.close?.())
        .catch(() => {});
    },
  };
}

/** Error text from an error chunk or a thrown provider error; never a key. */
function describeError(error: unknown): string {
  if (typeof error === "string") return error.slice(0, 200);
  const message = (error as { message?: unknown })?.message;
  if (typeof message === "string" && message.length > 0) return message.slice(0, 200);
  const name = (error as { name?: unknown })?.name;
  if (typeof name === "string" && name.length > 0) return name.slice(0, 200);
  return "error";
}
