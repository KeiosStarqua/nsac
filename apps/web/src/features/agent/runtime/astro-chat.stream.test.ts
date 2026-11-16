import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setChatSessionFactory, resetChatStateForTests, streamChatTurn } from "./astro-chat.server";
import { resetAgentModelCacheForTests } from "./agent-model.server";

// `streamChatTurn` is the same pipeline as `sendChatTurn` (astro-chat.test.ts covers the blocking
// path); these tests pin the streaming contract: deltas forwarded in order, the assistant message
// written ONCE per completed turn, and nothing written on any failure.
describe("streamChatTurn", () => {
  let dir: string;
  const prevSessions = process.env.NSAC_SKY_SESSIONS_DIR;
  const prevKey = process.env.SKY_OPENROUTER_API_KEY;
  const prevProvider = process.env.SKY_AGENT_PROVIDER;
  const prevBackend = process.env.BACKEND_URL;
  const prevKeyPath = process.env.NSAC_OPENCODE_KEY_PATH;
  const prevGoKey = process.env.SKY_OPENCODE_API_KEY;
  const prevGoFallback = process.env.OPENCODE_API_KEY;

  const transcript = (id = "ayla-reyes") =>
    JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as { messages: { role: string; text: string }[] };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nsac-sky-stream-"));
    process.env.NSAC_SKY_SESSIONS_DIR = dir;
    process.env.SKY_OPENROUTER_API_KEY = "sk-or-test-fake";
    process.env.SKY_AGENT_PROVIDER = "openrouter";
    process.env.BACKEND_URL = "http://127.0.0.1:1";
    // Stored-key file must not leak into these tests: point at a path that does not exist.
    process.env.NSAC_OPENCODE_KEY_PATH = join(dir, "no-such-opencode-key.json");
    delete process.env.SKY_OPENCODE_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    resetChatStateForTests();
  });

  afterEach(() => {
    if (prevSessions === undefined) delete process.env.NSAC_SKY_SESSIONS_DIR;
    else process.env.NSAC_SKY_SESSIONS_DIR = prevSessions;
    if (prevKey === undefined) delete process.env.SKY_OPENROUTER_API_KEY;
    else process.env.SKY_OPENROUTER_API_KEY = prevKey;
    if (prevKeyPath === undefined) delete process.env.NSAC_OPENCODE_KEY_PATH;
    else process.env.NSAC_OPENCODE_KEY_PATH = prevKeyPath;
    if (prevGoKey === undefined) delete process.env.SKY_OPENCODE_API_KEY;
    else process.env.SKY_OPENCODE_API_KEY = prevGoKey;
    if (prevGoFallback === undefined) delete process.env.OPENCODE_API_KEY;
    else process.env.OPENCODE_API_KEY = prevGoFallback;
    setChatSessionFactory(null);
    resetChatStateForTests();
    resetAgentModelCacheForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("hands the harness dock decision to onUiProgram when the artifacts carry chatDock", async () => {
    const ui: Array<[string, string | undefined]> = [];
    setChatSessionFactory((async (
      _profile: unknown,
      _ctx: unknown,
      overrides: { artifacts?: { hudProgram?: string; chatDock?: "right" } },
    ) => ({
      prompt: async () => {
        // As the show_on_hud tool would: validated program + dock land on the turn artifacts.
        if (overrides?.artifacts) {
          overrides.artifacts.hudProgram = "root = Surface([footer])";
          overrides.artifacts.chatDock = "right";
        }
        return "Stable.";
      },
      dispose: () => {},
    })) as any);

    const result = await streamChatTurn("ayla-reyes", "Show my heart rate", {
      onUiProgram: (program, dock) => ui.push([program, dock]),
    });

    expect(result.status).toBe("ok");
    expect(ui).toEqual([["root = Surface([footer])", "right"]]);
    expect(result.uiProgram).toBe("root = Surface([footer])");
    expect(result.uiDock).toBe("right");
  });

  it("omits the dock when the artifacts carry a program but no chatDock", async () => {
    const ui: Array<[string, string | undefined]> = [];
    setChatSessionFactory((async (
      _profile: unknown,
      _ctx: unknown,
      overrides: { artifacts?: { hudProgram?: string } },
    ) => ({
      prompt: async () => {
        if (overrides?.artifacts) overrides.artifacts.hudProgram = "root = Surface([footer])";
        return "Stable.";
      },
      dispose: () => {},
    })) as any);

    const result = await streamChatTurn("ayla-reyes", "Show my heart rate", {
      onUiProgram: (program, dock) => ui.push([program, dock]),
    });

    expect(result.status).toBe("ok");
    expect(ui).toEqual([["root = Surface([footer])", undefined]]);
    expect(result.uiDock).toBeUndefined();
  });

  it("forwards every delta in order and returns the whole reply", async () => {
    const deltas: string[] = [];
    setChatSessionFactory((async () => ({
      prompt: async (_text: string, opts: { onDelta?: (d: string) => void }) => {
        for (const delta of ["Stable", ". ", "Keep the dose."]) opts.onDelta?.(delta);
        return "Stable. Keep the dose.";
      },
      dispose: () => {},
    })) as any);

    const result = await streamChatTurn("ayla-reyes", "How am I?", { onDelta: (delta) => deltas.push(delta) });

    expect(deltas).toEqual(["Stable", ". ", "Keep the dose."]);
    expect(result.status).toBe("ok");
    expect(result.reply).toBe("Stable. Keep the dose.");
  });

  it("writes the assistant message once, trimmed and capped, after the deltas", async () => {
    setChatSessionFactory((async () => ({
      prompt: async (_text: string, opts: { onDelta?: (d: string) => void }) => {
        opts.onDelta?.("  Stable.  ");
        return "  Stable.  ";
      },
      dispose: () => {},
    })) as any);

    const result = await streamChatTurn("ayla-reyes", "hello");

    expect(result.status).toBe("ok");
    const onDisk = transcript();
    expect(onDisk.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(onDisk.messages[0]?.text).toBe("hello");
    expect(onDisk.messages[1]?.text).toBe("Stable.");
    expect(result.messages?.map((message) => message.role)).toEqual(["user", "assistant"]);
  });

  it("never forwards the reply twice when the deltas already covered it", async () => {
    const deltas: string[] = [];
    setChatSessionFactory((async () => ({
      prompt: async (_text: string, opts: { onDelta?: (d: string) => void }) => {
        opts.onDelta?.("whole reply");
        return "whole reply";
      },
      dispose: () => {},
    })) as any);

    await streamChatTurn("ayla-reyes", "hello", { onDelta: (delta) => deltas.push(delta) });

    expect(deltas).toEqual(["whole reply"]);
    expect(transcript().messages.filter((message) => message.role === "assistant")).toHaveLength(1);
  });

  it("returns unavailable and persists no assistant message when the session throws", async () => {
    const deltas: string[] = [];
    let disposed = false;
    setChatSessionFactory((async () => ({
      prompt: async (_text: string, opts: { onDelta?: (d: string) => void }) => {
        opts.onDelta?.("partial");
        throw new Error("provider_error");
      },
      dispose: () => {
        disposed = true;
      },
    })) as any);

    const result = await streamChatTurn("ayla-reyes", "hello", { onDelta: (delta) => deltas.push(delta) });

    expect(result.status).toBe("unavailable");
    expect(result.reply).toBeUndefined();
    expect(disposed).toBe(true);
    expect(deltas).toEqual(["partial"]);
    expect(transcript().messages.filter((message) => message.role === "assistant")).toHaveLength(0);
  });

  it("mode: voice appends one spoken-style answer line to the prompt suffix", async () => {
    let seen = "";
    setChatSessionFactory((async () => ({
      prompt: async (text: string) => {
        seen = text;
        return "ok";
      },
      dispose: () => {},
    })) as any);

    await streamChatTurn("ayla-reyes", "How am I?", { mode: "voice" });

    expect(seen).toBe(
      "How am I?\nThe user is speaking by voice: answer in one short sentence (at most two), natural spoken style.",
    );
  });

  it("without mode the prompt is byte-identical to the message", async () => {
    let seen = "";
    setChatSessionFactory((async () => ({
      prompt: async (text: string) => {
        seen = text;
        return "ok";
      },
      dispose: () => {},
    })) as any);

    await streamChatTurn("ayla-reyes", "How am I?");

    expect(seen).toBe("How am I?");
  });

  it("returns unavailable and persists no assistant message on an empty reply", async () => {
    setChatSessionFactory((async () => ({ prompt: async () => "   ", dispose: () => {} })) as any);

    const result = await streamChatTurn("ayla-reyes", "hello");

    expect(result.status).toBe("unavailable");
    expect(transcript().messages.filter((message) => message.role === "assistant")).toHaveLength(0);
  });

  it("aborts the turn when the caller's signal fires and reports a clean cancel", async () => {
    let disposed = false;
    let seenSignal: AbortSignal | undefined;
    setChatSessionFactory((async () => ({
      // A hung model: only the abort can end this promise.
      prompt: (_text: string, opts: { signal?: AbortSignal }) =>
        new Promise<string>((_, reject) => {
          seenSignal = opts.signal;
          opts.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      dispose: () => {
        disposed = true;
      },
    })) as any);

    const aborter = new AbortController();
    const pending = streamChatTurn("ayla-reyes", "hello", { signal: aborter.signal });
    await new Promise((resolve) => setTimeout(resolve, 5));
    aborter.abort();
    const result = await pending;

    expect(seenSignal).toBeDefined();
    // The caller hung up (SSE reader gone) — that is a cancel, not the profile's timeout wall.
    expect(result.status).toBe("aborted");
    expect(disposed).toBe(true);
    expect(transcript().messages.filter((message) => message.role === "assistant")).toHaveLength(0);
  });

  it("does not call the model without a key", async () => {
    delete process.env.SKY_OPENROUTER_API_KEY;
    let called = false;
    setChatSessionFactory((async () => {
      called = true;
      return { prompt: async () => "hi", dispose: () => {} };
    }) as any);

    const result = await streamChatTurn("ayla-reyes", "hello");

    expect(result.status).toBe("missing_key");
    expect(called).toBe(false);
  });

  it("serializes turns per astronaut id", async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setChatSessionFactory((async () => ({
      prompt: async (text: string) => {
        order.push(`start:${text}`);
        if (text === "one") await gate;
        order.push(`end:${text}`);
        return text;
      },
      dispose: () => {},
    })) as any);

    const first = streamChatTurn("ayla-reyes", "one");
    const second = streamChatTurn("ayla-reyes", "two");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(order).toEqual(["start:one"]);

    release();
    const [a, b] = await Promise.all([first, second]);
    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");
    expect(order).toEqual(["start:one", "end:one", "start:two", "end:two"]);
  });
});
