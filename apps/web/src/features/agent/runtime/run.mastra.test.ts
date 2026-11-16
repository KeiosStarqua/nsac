import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAgent, setSessionFactory } from "./run.server";
import { setMastraAgentFactoryForTests } from "../mastra/mastra-core.server";
import { resetAgentCoreCacheForTests } from "./agent-core.server";
import { resetAgentModelCacheForTests } from "./agent-model.server";

// `runAgent` resolves the core from the backend setting and keeps ONE status mapping for both cores.
describe("runAgent core selection", () => {
  let dir: string;
  const prev = {
    key: process.env.SKY_OPENROUTER_API_KEY,
    provider: process.env.SKY_AGENT_PROVIDER,
    backend: process.env.BACKEND_URL,
    keyPath: process.env.NSAC_OPENCODE_KEY_PATH,
    go: process.env.SKY_OPENCODE_API_KEY,
    goFallback: process.env.OPENCODE_API_KEY,
    db: process.env.NSAC_SKY_MASTRA_DB,
  };

  function stubBackend(core: "pi" | "mastra") {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        if (String(input).endsWith("/api/settings/agent-core")) {
          return { ok: true, status: 200, json: async () => ({ core, updatedAt: 1 }) } as unknown as Response;
        }
        throw new Error("down");
      }),
    );
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nsac-run-mastra-"));
    process.env.SKY_OPENROUTER_API_KEY = "sk-or-test-fake";
    process.env.SKY_AGENT_PROVIDER = "openrouter";
    process.env.BACKEND_URL = "http://127.0.0.1:1";
    process.env.NSAC_OPENCODE_KEY_PATH = join(dir, "no-such-key.json");
    process.env.NSAC_SKY_MASTRA_DB = join(dir, "sky-mastra.db");
    delete process.env.SKY_OPENCODE_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    setSessionFactory(null);
    resetAgentCoreCacheForTests();
    resetAgentModelCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setSessionFactory(null);
    setMastraAgentFactoryForTests(null);
    resetAgentCoreCacheForTests();
    resetAgentModelCacheForTests();
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore("SKY_OPENROUTER_API_KEY", prev.key);
    restore("SKY_AGENT_PROVIDER", prev.provider);
    restore("BACKEND_URL", prev.backend);
    restore("NSAC_OPENCODE_KEY_PATH", prev.keyPath);
    restore("SKY_OPENCODE_API_KEY", prev.go);
    restore("OPENCODE_API_KEY", prev.goFallback);
    restore("NSAC_SKY_MASTRA_DB", prev.db);
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs a one-shot through the Mastra core when the setting says mastra", async () => {
    stubBackend("mastra");
    setMastraAgentFactoryForTests(() => ({
      stream: async () => ({
        async *[Symbol.asyncIterator]() {
          yield { type: "text-delta", payload: { text: "panel text" } };
        },
        text: Promise.resolve("panel text"),
      }),
    }));

    const r = await runAgent("sky-generative-ui", "compose", { request: "compose", surface: "SKY HUD" });
    expect(r).toEqual({ status: "ok", text: "panel text" });
  });

  it("stays on the pi core when the setting is pi (Mastra never built)", async () => {
    stubBackend("pi");
    let mastraBuilt = 0;
    setMastraAgentFactoryForTests(() => {
      mastraBuilt += 1;
      return { stream: async () => ({ async *[Symbol.asyncIterator]() {}, text: Promise.resolve("") }) };
    });

    // The real pi factory runs (no network: the pi SDK only reads its model catalog here), and
    // resolves `unavailable` because that catalog has no keyless model for this provider.
    const r = await runAgent("sky-orchestrator", "hi");
    expect(r.status === "unavailable" || r.status === "missing_key").toBe(true);
    expect(mastraBuilt).toBe(0);
  });

  it("keeps the missing_key sentinel on the mastra core", async () => {
    stubBackend("mastra");
    delete process.env.SKY_OPENROUTER_API_KEY;
    const r = await runAgent("sky-orchestrator", "hi");
    expect(r).toEqual({ status: "missing_key", text: "" });
  });

  it("a test-injected session factory still short-circuits core resolution", async () => {
    // No backend stub at all: if the core were resolved the fetch would reject (and still resolve
    // pi), so the injected factory simply has to win.
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    setSessionFactory(async () => ({ prompt: async () => "injected", dispose: () => {} }));
    const r = await runAgent("sky-orchestrator", "hi");
    expect(r).toEqual({ status: "ok", text: "injected" });
  });
});
