import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setChatSessionFactory, resetChatStateForTests, sendChatTurn, loadChatHistory } from "./astro-chat.server";

// astro-chat.server resolves NSAC_SKY_SESSIONS_DIR at call time; each test gets a
// fresh tmp dir and a reset session cache, and real state is never touched.
describe("astro-chat", () => {
  let dir: string;
  const prevSessions = process.env.NSAC_SKY_SESSIONS_DIR;
  const prevKey = process.env.SKY_OPENROUTER_API_KEY;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nsac-sky-sessions-"));
    process.env.NSAC_SKY_SESSIONS_DIR = dir;
    process.env.SKY_OPENROUTER_API_KEY = "sk-or-test-fake";
    resetChatStateForTests();
  });

  afterEach(() => {
    if (prevSessions === undefined) delete process.env.NSAC_SKY_SESSIONS_DIR;
    else process.env.NSAC_SKY_SESSIONS_DIR = prevSessions;
    if (prevKey === undefined) delete process.env.SKY_OPENROUTER_API_KEY;
    else process.env.SKY_OPENROUTER_API_KEY = prevKey;
    setChatSessionFactory(null);
    resetChatStateForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("unknown astronaut rejected", async () => {
    const factory = async () => ({ prompt: async () => "hi", dispose: () => {} });
    setChatSessionFactory(factory as any);
    const r: any = await sendChatTurn("nope-unknown", "hello");
    expect(r.status).toBe("unavailable");
  });

  it("empty message rejected", async () => {
    setChatSessionFactory((async () => ({ prompt: async () => "hi", dispose: () => {} })) as any);
    const r: any = await sendChatTurn("ayla-reyes", "");
    expect(r.status).toBe("unavailable");
  });

  it("too long rejected", async () => {
    setChatSessionFactory((async () => ({ prompt: async () => "hi", dispose: () => {} })) as any);
    const r: any = await sendChatTurn("ayla-reyes", "a".repeat(501));
    expect(r.status).toBe("unavailable");
  });

  it("missing_key when no env key", async () => {
    delete process.env.SKY_OPENROUTER_API_KEY;
    let called = false;
    setChatSessionFactory((async () => { called = true; return { prompt: async () => "hi", dispose: () => {} }; }) as any);
    const r: any = await sendChatTurn("ayla-reyes", "hello");
    expect(r.status).toBe("missing_key");
    expect(called).toBe(false);
  });

  it("ok path appends turns and caps at 40", async () => {
    setChatSessionFactory(async () => ({ prompt: async () => "reply", dispose: () => {} }) as any);
    const r: any = await sendChatTurn("ayla-reyes", "hello");
    expect(r.status).toBe("ok");
    expect(r.messages.length).toBe(2);
  });

  it("two astronauts separate", async () => {
    let calls = 0;
    setChatSessionFactory((async () => { calls++; return { prompt: async () => "reply", dispose: () => {} }; }) as any);
    await sendChatTurn("ayla-reyes", "hi");
    await sendChatTurn("dae-jung-park", "hi");
    expect(calls).toBe(2);
    expect(existsSync(join(dir, "ayla-reyes.json"))).toBe(true);
    expect(existsSync(join(dir, "dae-jung-park.json"))).toBe(true);
  });

  it("factory error yields unavailable and clears cache", async () => {
    setChatSessionFactory((async () => { throw new Error("boom"); }) as any);
    const r: any = await sendChatTurn("ayla-reyes", "hi");
    expect(r.status).toBe("unavailable");
  });

  it("an empty reply from the session is unavailable and writes no empty assistant message", async () => {
    let disposed = false;
    setChatSessionFactory(async () => ({
      prompt: async () => "",
      dispose: () => {
        disposed = true;
      },
    }) as any);

    const r: any = await sendChatTurn("ayla-reyes", "hello");

    expect(r.status).toBe("unavailable");
    expect(disposed).toBe(true);
    const onDisk = JSON.parse(readFileSync(join(dir, "ayla-reyes.json"), "utf8")) as {
      messages: { role: string; text: string }[];
    };
    expect(onDisk.messages.filter((m) => m.role === "assistant")).toHaveLength(0);
  });

  it("a provider error thrown by the session is unavailable and persists no assistant message", async () => {
    let disposed = false;
    setChatSessionFactory(async () => ({
      prompt: async () => { throw new Error("provider_error"); },
      dispose: () => {
        disposed = true;
      },
    }) as any);

    const r: any = await sendChatTurn("ayla-reyes", "hello");

    expect(r.status).toBe("unavailable");
    expect(disposed).toBe(true);
    const onDisk = JSON.parse(readFileSync(join(dir, "ayla-reyes.json"), "utf8")) as {
      messages: { role: string; text: string }[];
    };
    expect(onDisk.messages.filter((m) => m.role === "assistant")).toHaveLength(0);
  });

  it("loadChatHistory returns prior turns", async () => {
    setChatSessionFactory(async () => ({ prompt: async () => "reply", dispose: () => {} }) as any);
    await sendChatTurn("ayla-reyes", "hello");
    const h = await loadChatHistory("ayla-reyes");
    expect(h.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("model switch disposes the cached session and recreates it; history is kept", async () => {
    // Backend trỏ tới cổng không bao giờ mở → currentAgentModel rơi về SKY_OPENROUTER_MODEL,
    // cho phép test đổi "model hiệu lực" một cách tất định.
    const prevBackend = process.env.BACKEND_URL;
    const prevModel = process.env.SKY_OPENROUTER_MODEL;
    process.env.BACKEND_URL = "http://127.0.0.1:1";
    process.env.SKY_OPENROUTER_MODEL = "test/model-one";
    const { resetAgentModelCacheForTests } = await import("./agent-model.server");
    resetAgentModelCacheForTests();
    try {
      let created = 0;
      let disposed = 0;
      setChatSessionFactory((async () => {
        created++;
        return { prompt: async () => "reply", dispose: () => { disposed++; } };
      }) as any);

      const first = await sendChatTurn("ayla-reyes", "hello");
      expect(first.status).toBe("ok");
      expect(created).toBe(1);
      expect(disposed).toBe(0);

      process.env.SKY_OPENROUTER_MODEL = "test/model-two";
      resetAgentModelCacheForTests();
      const second = await sendChatTurn("ayla-reyes", "hello again");
      expect(second.status).toBe("ok");
      expect(created).toBe(2);
      expect(disposed).toBe(1);

      // Lịch sử transcript (var/sky-sessions) vẫn còn sau khi session bị dispose.
      const h = await loadChatHistory("ayla-reyes");
      expect(h.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);

      // Ép cùng một model → session được tái sử dụng, không dispose.
      resetAgentModelCacheForTests();
      const third = await sendChatTurn("ayla-reyes", "once more");
      expect(third.status).toBe("ok");
      expect(created).toBe(2);
      expect(disposed).toBe(1);
    } finally {
      if (prevBackend === undefined) delete process.env.BACKEND_URL;
      else process.env.BACKEND_URL = prevBackend;
      if (prevModel === undefined) delete process.env.SKY_OPENROUTER_MODEL;
      else process.env.SKY_OPENROUTER_MODEL = prevModel;
      resetAgentModelCacheForTests();
    }
  });
});
