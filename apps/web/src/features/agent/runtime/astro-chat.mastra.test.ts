import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resetChatStateForTests,
  setChatSessionFactory,
  streamChatTurn,
} from "./astro-chat.server";
import { setMastraAgentFactoryForTests } from "../mastra/mastra-core.server";
import { resetAgentCoreCacheForTests } from "./agent-core.server";
import { resetAgentModelCacheForTests } from "./agent-model.server";

/**
 * The chat pipeline driven by the Mastra core: the backend `agent.core` row is `mastra`, the Mastra
 * agent is a fake injected at the same seam the pi tests use (`setChatSessionFactory` for the pure
 * pipeline cases, `setMastraAgentFactoryForTests` when the real Mastra facade must run).
 *
 * Every assertion here is about the pipeline AFTER the session exists, which must be identical on
 * both cores: deltas in order, one assistant message on success, nothing written on failure, and the
 * caller's abort mapped to the `timeout` sentinel.
 */
describe("astro-chat on the mastra core", () => {
  let dir: string;
  const prev = {
    sessions: process.env.NSAC_SKY_SESSIONS_DIR,
    key: process.env.SKY_OPENROUTER_API_KEY,
    provider: process.env.SKY_AGENT_PROVIDER,
    backend: process.env.BACKEND_URL,
    keyPath: process.env.NSAC_OPENCODE_KEY_PATH,
    go: process.env.SKY_OPENCODE_API_KEY,
    goFallback: process.env.OPENCODE_API_KEY,
    db: process.env.NSAC_SKY_MASTRA_DB,
  };

  const transcript = (id = "ayla-reyes") =>
    JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as { messages: { role: string; text: string }[] };

  /** Backend stub: only the core setting answers; everything else is "down". */
  function stubBackend(core: "pi" | "mastra") {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.endsWith("/api/settings/agent-core")) {
          return { ok: true, status: 200, json: async () => ({ core, updatedAt: 1 }) } as unknown as Response;
        }
        throw new Error("down");
      }),
    );
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nsac-sky-mastra-chat-"));
    process.env.NSAC_SKY_SESSIONS_DIR = dir;
    process.env.SKY_OPENROUTER_API_KEY = "sk-or-test-fake";
    process.env.SKY_AGENT_PROVIDER = "openrouter";
    process.env.BACKEND_URL = "http://127.0.0.1:1";
    process.env.NSAC_OPENCODE_KEY_PATH = join(dir, "no-such-opencode-key.json");
    process.env.NSAC_SKY_MASTRA_DB = join(dir, "sky-mastra.db");
    delete process.env.SKY_OPENCODE_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    resetChatStateForTests();
    resetAgentCoreCacheForTests();
    resetAgentModelCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setChatSessionFactory(null);
    setMastraAgentFactoryForTests(null);
    resetChatStateForTests();
    resetAgentCoreCacheForTests();
    resetAgentModelCacheForTests();
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore("NSAC_SKY_SESSIONS_DIR", prev.sessions);
    restore("SKY_OPENROUTER_API_KEY", prev.key);
    restore("SKY_AGENT_PROVIDER", prev.provider);
    restore("BACKEND_URL", prev.backend);
    restore("NSAC_OPENCODE_KEY_PATH", prev.keyPath);
    restore("SKY_OPENCODE_API_KEY", prev.go);
    restore("OPENCODE_API_KEY", prev.goFallback);
    restore("NSAC_SKY_MASTRA_DB", prev.db);
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs the whole turn through the Mastra facade: deltas, transcript, memory thread", async () => {
    stubBackend("mastra");
    const seen: Record<string, unknown>[] = [];
    setMastraAgentFactoryForTests(() => ({
      stream: async (_text, opts) => {
        seen.push(opts);
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: "text-delta", payload: { text: "Stable" } };
            yield { type: "text-delta", payload: { text: ". Keep the dose." } };
          },
          text: Promise.resolve("Stable. Keep the dose."),
        };
      },
    }));

    const deltas: string[] = [];
    const result = await streamChatTurn("ayla-reyes", "How am I?", { onDelta: (d) => deltas.push(d) });

    expect(result.status).toBe("ok");
    expect(deltas).toEqual(["Stable", ". Keep the dose."]);
    expect(result.reply).toBe("Stable. Keep the dose.");
    expect(seen[0]?.memory).toEqual({ thread: "astronaut:ayla-reyes", resource: "astronaut:ayla-reyes" });
    // Same transcript contract as the pi core (one assistant message, written once).
    expect(transcript().messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    // The pi JSONL session file is never created on the mastra core.
    expect(existsSync(join(dir, "ayla-reyes.jsonl"))).toBe(false);
  });

  it("maps an aborted mastra turn to the timeout sentinel and keeps the transcript clean", async () => {
    stubBackend("mastra");
    setMastraAgentFactoryForTests(() => ({
      stream: async (_text, opts) => ({
        async *[Symbol.asyncIterator]() {
          const signal = opts.abortSignal as AbortSignal;
          await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
          yield { type: "abort" };
        },
        text: Promise.resolve(""),
      }),
    }));

    const aborter = new AbortController();
    const pending = streamChatTurn("ayla-reyes", "hello", { signal: aborter.signal });
    setTimeout(() => aborter.abort(), 10);
    const result = await pending;

    expect(result.status).toBe("timeout");
    expect(transcript().messages.filter((m) => m.role === "assistant")).toHaveLength(0);
  });

  it("returns unavailable and persists nothing when the mastra turn errors", async () => {
    stubBackend("mastra");
    setMastraAgentFactoryForTests(() => ({
      stream: async () => {
        throw new Error("provider_error");
      },
    }));

    const result = await streamChatTurn("ayla-reyes", "hello");

    expect(result.status).toBe("unavailable");
    expect(transcript().messages.filter((m) => m.role === "assistant")).toHaveLength(0);
  });

  it("returns missing_key on the mastra core too (no key for the effective provider)", async () => {
    stubBackend("mastra");
    delete process.env.SKY_OPENROUTER_API_KEY;
    let built = 0;
    setMastraAgentFactoryForTests(() => {
      built += 1;
      return { stream: async () => ({ async *[Symbol.asyncIterator]() {}, text: Promise.resolve("") }) };
    });

    const result = await streamChatTurn("ayla-reyes", "hello");

    expect(result.status).toBe("missing_key");
    expect(built).toBe(0);
  });

  it("flipping the core evicts the cached session (key is core:provider:model)", async () => {
    let created = 0;
    let disposed = 0;
    setChatSessionFactory((async () => {
      created += 1;
      return {
        prompt: async () => "reply",
        dispose: () => {
          disposed += 1;
        },
      };
    }) as any);

    stubBackend("pi");
    const first = await streamChatTurn("ayla-reyes", "hello");
    expect(first.status).toBe("ok");
    expect(created).toBe(1);
    expect(disposed).toBe(0);

    // Admin switches the core: the next read of `agent.core` answers mastra.
    resetAgentCoreCacheForTests();
    stubBackend("mastra");
    const second = await streamChatTurn("ayla-reyes", "hello again");
    expect(second.status).toBe("ok");
    expect(created).toBe(2);
    expect(disposed).toBe(1);

    // Same core again → the session is reused, not rebuilt.
    resetAgentCoreCacheForTests();
    const third = await streamChatTurn("ayla-reyes", "once more");
    expect(third.status).toBe("ok");
    expect(created).toBe(2);
    expect(disposed).toBe(1);

    // The pi JSONL transcript is untouched by the core flip (it is the UI transcript, not history).
    expect(transcript().messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
  });
});
