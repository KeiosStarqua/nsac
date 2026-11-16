import "@tanstack/react-start/server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Mastra } from "@mastra/core/mastra";
import type { Observability } from "@mastra/observability";
import { LibSQLStore } from "@mastra/libsql";
import { readLangfuseConfig } from "../runtime/langfuse-key.server";
import { mastraDbUrl } from "./mastra-core.server";
import { buildSchedulesHooks, scrubScheduledFireError } from "./mastra-schedules.server";

/**
 * Langfuse tracing for the Mastra core (HARNESSING §18.5).
 *
 * Official integration only: `@mastra/observability` `Observability` + `@mastra/langfuse`
 * `LangfuseExporter`, mounted on a root `Mastra` instance that agents are registered into
 * (`mastra.addAgent(agent, profile.id)` in `mastra-core.server.ts`). No AI-SDK exporter, no
 * hand-wired OpenTelemetry, no gateway. The exporter keeps Langfuse's default **batch** mode
 * (`realtime: false`): it buffers spans and flushes on its own interval, so a turn never waits
 * on the tracing backend.
 *
 * Everything here is **gated on configuration**: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and
 * `LANGFUSE_BASE_URL` must all be present, either from the box environment or from the write-only
 * file the hidden `/admin/keys` panel stores (`var/sky-langfuse.json`, mode 0600 — see
 * `runtime/langfuse-key.server.ts`). Env wins as a whole triple; the stored file is the fallback.
 * `LANGFUSE_BASE_URL` is REQUIRED on purpose — no default, so this deployment can never silently
 * ship astronaut turns to `cloud.langfuse.com`. When the gate is closed (or anything below fails)
 * this module returns `null` and the turn runs exactly as before: tracing is best effort, never a
 * dependency.
 *
 * Keys still never live in this repo: they come from the host env file or the gitignored store. The
 * enabled root is cached per process, so turning tracing ON via the panel applies to the next turn,
 * while swapping keys on an already-enabled process needs a restart.
 *
 * Two sinks now (they are independent): the backend SQLite `agent_traces` rows (§16, always on
 * when the backend is reachable) and Langfuse (§18.5, config-gated, Mastra core only).
 *
 * **Schedules (§19, 2026-11-17):** the root always carries
 * `storage: new LibSQLStore({ id: "sky-root", url: mastraDbUrl() })` (the schedules domain lives
 * in the same LibSQL file as memory/threads) and `schedules: <hook bundle>` from
 * `mastra-schedules.server.ts`, plus `scheduler: { enabled: true }` so imperative schedules
 * (created via /admin/schedules) are honored without any declarative workflow config. The
 * Langfuse exporter is layered on top only when the gate is open; when it is closed the root
 * still builds — "tracing off" and "schedules on" are independent. `ensureSkyMastraRoot()` is the
 * one construction path (boot plugin + tracing call-sites); `getMastraRoot()` keeps its exact
 * gate semantics for callers. The root is built lazily on first call — never at import time —
 * and registers the generic, astronaut-agnostic `sky-chat` once (`buildEagerSkyChatAgent`),
 * so scheduled fires resolve the profile even before any chat turn ran.
 *
 * Nothing is constructed at import time — the root `Mastra`, the `Observability` instance and
 * the exporter are built lazily on the first traced session and cached for the process, because
 * Nitro/vite import server modules during the build.
 */

export type MastraObservabilityEnv = {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  environment: string;
  release?: string;
};

/** Trimmed, non-empty env value — an empty or whitespace-only variable counts as unset. */
function envValue(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve the tracing configuration from env (wins) or the `/admin/keys`-stored file, or `null`
 * when the gate is closed. `baseUrl` has no default: a missing base is "tracing off", never the
 * cloud endpoint. `environment` / `release` are env-only optional tags.
 */
export function mastraObservabilityEnv(): MastraObservabilityEnv | null {
  const config = readLangfuseConfig();
  if (!config) return null;
  return {
    publicKey: config.publicKey,
    secretKey: config.secretKey,
    baseUrl: config.baseUrl,
    environment: config.environment ?? envValue("NODE_ENV") ?? "development",
    release:
      config.release ??
      envValue("npm_package_version") ??
      envValue("NSAC_GIT_SHA") ??
      envValue("GIT_SHA"),
  };
}

/** True iff all three required values resolve from env or the stored file. */
export function mastraObservabilityEnabled(): boolean {
  return mastraObservabilityEnv() !== null;
}

/**
 * The two lazy imports, typed through their real packages so the config literals below are
 * checked. Test seam only.
 */
export type ObservabilityImports = {
  Observability: typeof import("@mastra/observability").Observability;
  LangfuseExporter: typeof import("@mastra/langfuse").LangfuseExporter;
};

async function importObservabilityRuntime(): Promise<ObservabilityImports> {
  const [observability, langfuse] = await Promise.all([
    import("@mastra/observability"),
    import("@mastra/langfuse"),
  ]);
  return { Observability: observability.Observability, LangfuseExporter: langfuse.LangfuseExporter };
}

let importRuntime: () => Promise<ObservabilityImports> = importObservabilityRuntime;

/** Process-wide cache (§19: storage + hooks always). `undefined` = not built yet, `null` = init failed. */
let rootPromise: Promise<Mastra | null> | null = null;

/** Test override: an object short-circuits everything; `null` means "tracing off". */
let rootOverride: Mastra | null | undefined = undefined;

let warned = false;

/** One warning per process, with the configured secrets scrubbed out of the message. */
function warnOnce(message: string, secrets: string[] = []): void {
  if (warned) return;
  warned = true;
  let text = message;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) text = text.split(secret).join("[redacted]");
  }
  console.warn("mastra observability disabled", text.slice(0, 200));
}

/**
 * Report a failure from a caller that already caught it (`createMastraSession` registration).
 * Shares the process-wide once-only flag so a broken tracing setup logs one line, not one per turn.
 */
export function noteMastraObservabilityFailure(error: unknown): void {
  const message =
    typeof (error as { message?: unknown })?.message === "string"
      ? String((error as { message?: unknown }).message)
      : String(error);
  const env = mastraObservabilityEnv();
  warnOnce(message, env ? [env.publicKey, env.secretKey] : []);
}

/**
 * The one construction path for the process-wide root (§19): storage + schedule hooks are
 * UNCONDITIONAL; the Langfuse exporter is attached only when the gate is open. Cached per
 * process. Never throws — a build failure warns once and resolves `null`.
 */
async function buildSkyMastraRoot(): Promise<Mastra> {
  const env = mastraObservabilityEnv();
  const url = mastraDbUrl();
  if (url.startsWith("file:")) {
    try {
      mkdirSync(dirname(url.slice("file:".length)), { recursive: true, mode: 0o700 });
    } catch {
      // Best effort — LibSQL surfaces a usable error if the directory really is missing.
    }
  }
  let observability: Observability | undefined;
  if (env) {
    const { Observability: ObservabilityCtor, LangfuseExporter } = await importRuntime();
    const exporter = new LangfuseExporter({
      publicKey: env.publicKey,
      secretKey: env.secretKey,
      baseUrl: env.baseUrl,
      // Batch mode is the documented default for production; realtime is a dev-only convenience.
      realtime: false,
      environment: env.environment,
      ...(env.release ? { release: env.release } : {}),
    });
    observability = new ObservabilityCtor({
      configs: {
        langfuse: { serviceName: "sky-nsac", exporters: [exporter] },
      },
    });
  }
  // Agents are NOT registered for tracing here per-agent; the root gets storage + hooks, and a
  // single eager `sky-chat` (no astronaut identity — the prepared prompt carries it at fire
  // time) so scheduled fires resolve the profile without any prior chat turn.
  const root = new Mastra({
    storage: new LibSQLStore({ id: "sky-root", url }),
    // Schedules are managed imperatively (/admin/schedules); the scheduler must run even
    // though no workflow declares a declarative schedule.
    scheduler: { enabled: true },
    schedules: buildSchedulesHooks(),
    ...(observability ? { observability } : {}),
  });
  try {
    const core = await import("./mastra-core.server");
    const agent = await core.buildEagerSkyChatAgent();
    if (agent) {
      // Remove-then-add, same discipline as createMastraSession: never MASTRA_ADD_AGENT_DUPLICATE_KEY.
      if (typeof root.removeAgent === "function") root.removeAgent("sky-chat");
      root.addAgent(agent, "sky-chat");
    }
  } catch (error) {
    console.warn("[sky-schedules] eager sky-chat registration failed:", scrubScheduledFireError(error));
  }
  return root;
}

/**
 * The tracing root for this process when the gate is open, or the schedules-capable root
 * (§19) — same shared builder, same cached promise. Never throws: an import or init failure
 * warns once and resolves `null`, so the caller's turn runs unchanged.
 */
export async function ensureSkyMastraRoot(): Promise<Mastra | null> {
  if (rootOverride !== undefined) return rootOverride;
  if (rootPromise) return rootPromise;
  rootPromise = buildSkyMastraRoot().catch((error: unknown) => {
    noteMastraObservabilityFailure(error);
    return null;
  });
  return rootPromise;
}

/**
 * The tracing root for this process, or `null` when tracing is off. Never throws: an import or
 * init failure warns once and resolves `null`, so the caller's turn runs unchanged.
 */
export async function getMastraRoot(): Promise<Mastra | null> {
  if (rootOverride !== undefined) return rootOverride;
  // Disabled is not cached: the gate is cheap to re-read and a runtime change may open it.
  if (!mastraObservabilityEnv()) return null;
  return ensureSkyMastraRoot();
}

/** Test seam: `undefined` restores the real lazily-built root, `null` forces "tracing off". */
export function setMastraRootForTests(root: Mastra | null | undefined): void {
  rootOverride = root;
}

/**
 * Test seam: replace the dynamic imports (and clear the cached root + the warning latch, so a
 * stub never inherits a previous test's state).
 */
export function setObservabilityImportForTests(stub: (() => Promise<ObservabilityImports>) | null): void {
  importRuntime = stub ?? importObservabilityRuntime;
  rootPromise = null;
  warned = false;
}
