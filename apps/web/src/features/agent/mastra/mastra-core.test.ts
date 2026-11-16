import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createMastraSession,
  mastraDbUrl,
  mastraMaxSteps,
  mastraThreadId,
  setMastraAgentFactoryForTests,
} from "./mastra-core.server";
import { resetAgentModelCacheForTests } from "../runtime/agent-model.server";
import type { AgentContext, AgentProfile } from "../agents/types";
import { getAgent } from "../agents/registry";

// The Mastra core behind a fake agent: everything below the "build the Agent" seam is exercised for
// real (provider/model resolution, instructions, artifacts, delta/abort/error handling).
type Chunk = { type: string; payload?: Record<string, unknown> };

function fakeStream(chunks: Chunk[], text = "") {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
    text: Promise.resolve(text),
  };
}

const CHAT: AgentProfile = getAgent("sky-chat");
const ONESHOT: AgentProfile = getAgent("sky-generative-ui");

const astronaut = { name: "Ayla Reyes", role: "Commander", callsign: "AR" } as const;

describe("createMastraSession", () => {
  let dir: string;
  const prevKeys = {
    go: process.env.SKY_OPENCODE_API_KEY,
    goFallback: process.env.OPENCODE_API_KEY,
    goPath: process.env.NSAC_OPENCODE_KEY_PATH,
    provider: process.env.SKY_AGENT_PROVIDER,
    backend: process.env.BACKEND_URL,
    db: process.env.NSAC_SKY_MASTRA_DB,
    baseUrl: process.env.SKY_OPENCODE_BASE_URL,
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nsac-mastra-"));
    process.env.SKY_OPENCODE_API_KEY = "test-go-key";
    delete process.env.OPENCODE_API_KEY;
    process.env.NSAC_OPENCODE_KEY_PATH = join(dir, "no-such-key.json");
    process.env.SKY_AGENT_PROVIDER = "opencode-go";
    process.env.BACKEND_URL = "http://127.0.0.1:1";
    process.env.NSAC_SKY_MASTRA_DB = join(dir, "sky-mastra.db");
    delete process.env.SKY_OPENCODE_BASE_URL;
    resetAgentModelCacheForTests();
  });

  afterEach(() => {
    setMastraAgentFactoryForTests(null);
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore("SKY_OPENCODE_API_KEY", prevKeys.go);
    restore("OPENCODE_API_KEY", prevKeys.goFallback);
    restore("NSAC_OPENCODE_KEY_PATH", prevKeys.goPath);
    restore("SKY_AGENT_PROVIDER", prevKeys.provider);
    restore("BACKEND_URL", prevKeys.backend);
    restore("NSAC_SKY_MASTRA_DB", prevKeys.db);
    restore("SKY_OPENCODE_BASE_URL", prevKeys.baseUrl);
    resetAgentModelCacheForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("throws the missing_key sentinel when the provider has no key", async () => {
    delete process.env.SKY_OPENCODE_API_KEY;
    let built = 0;
    setMastraAgentFactoryForTests(() => {
      built += 1;
      return { stream: async () => fakeStream([]) };
    });

    await expect(createMastraSession(CHAT, { request: "", astronaut, astronautId: "ayla-reyes" })).rejects.toThrow(
      "missing_key",
    );
    expect(built).toBe(0);
  });

  it("builds the chat Agent with the pi-model routing id, memory and the one tool", async () => {
    let config: Record<string, any> | null = null;
    setMastraAgentFactoryForTests((c) => {
      config = c;
      return { stream: async () => fakeStream([{ type: "text-delta", payload: { text: "ok" } }], "ok") };
    });

    const session = await createMastraSession(CHAT, {
      request: "",
      astronaut,
      astronautId: "ayla-reyes",
    });
    session.dispose();

    expect(config).not.toBeNull();
    expect(config!.id).toBe("sky-chat");
    expect(config!.name).toBe("Sky");
    expect(config!.model).toEqual({
      id: "opencode-go/deepseek-v4.1-flash",
      url: "https://opencode.ai/inference/go/openai/v1",
      apiKey: "test-go-key",
    });
    // Only sky-chat carries a tool; nothing else is ever added.
    expect(Object.keys(config!.tools as Record<string, unknown>)).toEqual(["show_on_hud"]);
    // Chat memory is a Mastra Memory instance (LibSQL backed), one per session.
    expect(config!.memory).toBeTruthy();
    expect(config!.instructions).toContain("You are speaking with Ayla Reyes");
    // Parity with pi's `retry: { enabled: false }`: no silent provider retry.
    expect(config!.maxRetries).toBe(0);
  });

  it("gives one-shot runners no memory and no tools", async () => {
    let config: Record<string, any> | null = null;
    setMastraAgentFactoryForTests((c) => {
      config = c;
      return { stream: async () => fakeStream([{ type: "text-delta", payload: { text: "ok" } }], "ok") };
    });

    const session = await createMastraSession(ONESHOT, { request: "compose a panel" });
    session.dispose();

    expect(config!.id).toBe("sky-generative-ui");
    expect(config!.memory).toBeUndefined();
    expect(config!.tools).toBeUndefined();
    expect(config!.instructions).toContain("compose a panel");
  });

  it("appends promptSuffix after a newline, like the pi core", async () => {
    let config: Record<string, any> | null = null;
    setMastraAgentFactoryForTests((c) => {
      config = c;
      return { stream: async () => fakeStream([{ type: "text-delta", payload: { text: "ok" } }], "ok") };
    });
    const base = CHAT.systemPrompt({ request: "", astronaut });

    const session = await createMastraSession(
      CHAT,
      { request: "", astronaut, astronautId: "ayla-reyes" },
      { promptSuffix: "SUFFIX LINE" },
    );
    session.dispose();

    expect(config!.instructions).toBe(`${base}\nSUFFIX LINE`);
  });

  it("forwards deltas in order and returns the whole reply", async () => {
    const seen: Record<string, unknown> = {};
    setMastraAgentFactoryForTests(() => ({
      stream: async (_text, opts) => {
        Object.assign(seen, opts);
        return fakeStream(
          [
            { type: "text-delta", payload: { text: "Stable" } },
            { type: "text-delta", payload: { text: ". " } },
            { type: "text-delta", payload: { text: "Keep the dose." } },
          ],
          "Stable. Keep the dose.",
        );
      },
    }));

    const session = await createMastraSession(CHAT, { request: "", astronaut, astronautId: "ayla-reyes" });
    const deltas: string[] = [];
    const reply = await session.prompt("How am I?", { onDelta: (d) => deltas.push(d) });
    session.dispose();

    expect(deltas).toEqual(["Stable", ". ", "Keep the dose."]);
    expect(reply).toBe("Stable. Keep the dose.");
    // Chat: 3 steps (tool call + final text), 2048 max output tokens, astronaut thread id.
    expect(seen.maxSteps).toBe(3);
    expect(seen.modelSettings).toEqual({ maxOutputTokens: 2048 });
    expect(seen.memory).toEqual({ thread: "astronaut:ayla-reyes", resource: "astronaut:ayla-reyes" });
  });

  it("one-shot runners ask for 2 steps and no memory", async () => {
    let seen: Record<string, unknown> = {};
    setMastraAgentFactoryForTests(() => ({
      stream: async (_text, opts) => {
        seen = opts;
        return fakeStream([{ type: "text-delta", payload: { text: "ok" } }], "ok");
      },
    }));

    const session = await createMastraSession(ONESHOT, { request: "x" });
    await session.prompt("x", {});
    session.dispose();

    expect(seen.maxSteps).toBe(2);
    expect(seen.memory).toBeUndefined();
  });

  it("records tool outcomes in the turn artifacts and clears them per turn", async () => {
    const artifacts: { hudProgram?: string; tools?: { name: string; ok: boolean }[] } = { tools: [{ name: "stale", ok: true }] };
    let turn = 0;
    setMastraAgentFactoryForTests(() => ({
      stream: async () => {
        turn += 1;
        const chunks: Chunk[] =
          turn === 1
            ? [
                { type: "tool-result", payload: { toolName: "show_on_hud", isError: false } },
                { type: "text-delta", payload: { text: "done" } },
              ]
            : [{ type: "text-delta", payload: { text: "just talking" } }];
        return fakeStream(chunks, "done");
      },
    }));

    const session = await createMastraSession(
      CHAT,
      { request: "", astronaut, astronautId: "ayla-reyes" },
      { artifacts },
    );
    await session.prompt("show it", {});
    expect(artifacts.tools).toEqual([{ name: "show_on_hud", ok: true }]);

    // A turn that calls no tool must not inherit the previous turn's outcomes.
    await session.prompt("just talking", {});
    expect(artifacts.tools).toBeUndefined();
    session.dispose();
    expect(turn).toBe(2);
  });

  it("empty delta stream → empty_reply, unless the run's final text still carries the reply", async () => {
    setMastraAgentFactoryForTests(() => ({ stream: async () => fakeStream([], "") }));
    const empty = await createMastraSession(CHAT, { request: "", astronaut, astronautId: "ayla-reyes" });
    await expect(empty.prompt("hi", {})).rejects.toThrow("empty_reply");
    empty.dispose();

    setMastraAgentFactoryForTests(() => ({ stream: async () => fakeStream([], "  recovered  ") }));
    const recovered = await createMastraSession(CHAT, { request: "", astronaut, astronautId: "ayla-reyes" });
    await expect(recovered.prompt("hi", {})).resolves.toBe("recovered");
    recovered.dispose();
  });

  it("an error chunk throws the provider message", async () => {
    setMastraAgentFactoryForTests(() => ({
      stream: async () => fakeStream([{ type: "error", payload: { error: new Error("402 payment required") } }]),
    }));
    const session = await createMastraSession(CHAT, { request: "", astronaut, astronautId: "ayla-reyes" });
    await expect(session.prompt("hi", {})).rejects.toThrow("402 payment required");
    session.dispose();
  });

  it("a thrown provider error surfaces as the turn error", async () => {
    setMastraAgentFactoryForTests(() => ({
      stream: async () => {
        throw new Error("ECONNREFUSED");
      },
    }));
    const session = await createMastraSession(CHAT, { request: "", astronaut, astronautId: "ayla-reyes" });
    await expect(session.prompt("hi", {})).rejects.toThrow("ECONNREFUSED");
    session.dispose();
  });

  it("an abort chunk throws aborted, and disposal aborts an in-flight turn", async () => {
    setMastraAgentFactoryForTests(() => ({ stream: async () => fakeStream([{ type: "abort" }], "partial") }));
    const aborted = await createMastraSession(CHAT, { request: "", astronaut, astronautId: "ayla-reyes" });
    await expect(aborted.prompt("hi", {})).rejects.toThrow("aborted");
    aborted.dispose();

    // A hanging stream: only dispose() can end it.
    let signal: AbortSignal | undefined;
    setMastraAgentFactoryForTests(() => ({
      stream: async (_text, opts) => {
        signal = opts.abortSignal as AbortSignal;
        return {
          async *[Symbol.asyncIterator]() {
            await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
            yield { type: "abort" };
          },
          text: Promise.resolve(""),
        };
      },
    }));
    const hung = await createMastraSession(CHAT, { request: "", astronaut, astronautId: "ayla-reyes" });
    const pending = hung.prompt("hi", {});
    await new Promise((resolve) => setTimeout(resolve, 5));
    hung.dispose();
    await expect(pending).rejects.toThrow("aborted");
    expect(signal?.aborted).toBe(true);
  });

  it("the caller's signal aborts the turn", async () => {
    setMastraAgentFactoryForTests(() => ({
      stream: async (_text, opts) => ({
        async *[Symbol.asyncIterator]() {
          const s = opts.abortSignal as AbortSignal;
          await new Promise<void>((resolve) => s.addEventListener("abort", () => resolve(), { once: true }));
          yield { type: "abort" };
        },
        text: Promise.resolve(""),
      }),
    }));
    const session = await createMastraSession(CHAT, { request: "", astronaut, astronautId: "ayla-reyes" });
    const ac = new AbortController();
    const pending = session.prompt("hi", { signal: ac.signal });
    setTimeout(() => ac.abort(), 5);
    await expect(pending).rejects.toThrow("aborted");
    session.dispose();
  });
});

describe("mastraThreadId / mastraDbUrl / mastraMaxSteps", () => {
  it("derives astronaut:<id>, falling back to global", () => {
    const withId = { request: "", astronautId: "ayla-reyes" } as AgentContext;
    expect(mastraThreadId(withId)).toBe("astronaut:ayla-reyes");
    expect(mastraThreadId({ request: "" })).toBe("global");
    expect(mastraThreadId({ request: "", astronautId: "  " })).toBe("global");
    // Whatever lands in the id is sanitized (never a raw path separator).
    expect(mastraThreadId({ request: "", astronautId: "../../etc/passwd" })).toBe("astronaut:etcpasswd");
  });

  it("resolves var/sky-mastra.db, honouring NSAC_SKY_MASTRA_DB", () => {
    const prev = process.env.NSAC_SKY_MASTRA_DB;
    try {
      delete process.env.NSAC_SKY_MASTRA_DB;
      expect(mastraDbUrl()).toBe(`file:${process.cwd()}/var/sky-mastra.db`);
      process.env.NSAC_SKY_MASTRA_DB = "/tmp/custom.db";
      expect(mastraDbUrl()).toBe("file:/tmp/custom.db");
      process.env.NSAC_SKY_MASTRA_DB = "file:/tmp/already.db";
      expect(mastraDbUrl()).toBe("file:/tmp/already.db");
      process.env.NSAC_SKY_MASTRA_DB = "libsql://example.turso.io";
      expect(mastraDbUrl()).toBe("libsql://example.turso.io");
    } finally {
      if (prev === undefined) delete process.env.NSAC_SKY_MASTRA_DB;
      else process.env.NSAC_SKY_MASTRA_DB = prev;
    }
  });

  it("gives chat 3 steps and one-shots 2", () => {
    expect(mastraMaxSteps("sky-chat")).toBe(3);
    expect(mastraMaxSteps("sky-generative-ui")).toBe(2);
    expect(mastraMaxSteps("sky-medical-officer")).toBe(2);
  });
});
