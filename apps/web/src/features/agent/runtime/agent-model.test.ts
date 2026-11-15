import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  currentAgentModel,
  currentAgentProvider,
  currentAgentProviderInfo,
  modelChanged,
  resetAgentModelCacheForTests,
} from "./agent-model.server";

// agent-model.server tự fetch backend (BACKEND_URL, mặc định 127.0.0.1:3200) với timeout ~1.2s.
// Mọi test ở đây stub global fetch nên không bao giờ chạm mạng/DB thật.
const ENV_KEY = "SKY_OPENROUTER_MODEL";
const GO_ENV_KEY = "SKY_OPENCODE_MODEL";
const GLOBAL_ENV_KEY = "SKY_AGENT_MODEL";
const PROVIDER_ENV_KEY = "SKY_AGENT_PROVIDER";
const BACKEND_KEY = "BACKEND_URL";

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/** Stub fetch: trả payload agent-models cho mọi URL (đủ cho GET /agent-models và parse legacy). */
const stubBackend = (body: unknown) =>
  vi.stubGlobal("fetch", vi.fn(async () => okResponse(body)));

beforeEach(() => {
  resetAgentModelCacheForTests();
  process.env[BACKEND_KEY] = "http://127.0.0.1:1";
  delete process.env[PROVIDER_ENV_KEY];
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetAgentModelCacheForTests();
  delete process.env[BACKEND_KEY];
  delete process.env[ENV_KEY];
  delete process.env[GO_ENV_KEY];
  delete process.env[GLOBAL_ENV_KEY];
  delete process.env[PROVIDER_ENV_KEY];
});

describe("modelChanged", () => {
  it("false khi bằng nhau (bỏ qua khoảng trắng thừa)", () => {
    expect(modelChanged("a/b", "a/b")).toBe(false);
    expect(modelChanged("  a/b  ", "a/b")).toBe(false);
    expect(modelChanged(null, null)).toBe(false);
    expect(modelChanged(undefined, "")).toBe(false);
  });
  it("true khi khác nhau", () => {
    expect(modelChanged("a/b", "a/c")).toBe(true);
    expect(modelChanged(null, "a/b")).toBe(true);
    expect(modelChanged("a/b", null)).toBe(true);
  });
});

describe("currentAgentProvider", () => {
  it("default khi backend chưa set và không có env → opencode-go", async () => {
    stubBackend({ provider: null, model: null, models: null, updatedAt: null });
    expect(await currentAgentProvider()).toBe("opencode-go");
  });

  it("backend set provider → dùng provider đó", async () => {
    stubBackend({ provider: "openrouter", model: null, models: null, updatedAt: 1 });
    expect(await currentAgentProvider()).toBe("openrouter");
  });

  it("backend rác provider → fallback env → default", async () => {
    stubBackend({ provider: "banana", model: null, models: null, updatedAt: 1 });
    expect(await currentAgentProvider()).toBe("opencode-go");
    process.env[PROVIDER_ENV_KEY] = "openrouter";
    resetAgentModelCacheForTests();
    expect(await currentAgentProvider()).toBe("openrouter");
  });

  it("env SKY_AGENT_PROVIDER ghi đè default nhưng không ghi đè backend", async () => {
    stubBackend({ provider: null, model: null, models: null, updatedAt: null });
    process.env[PROVIDER_ENV_KEY] = "openrouter";
    expect(await currentAgentProvider()).toBe("openrouter");
    resetAgentModelCacheForTests();
    stubBackend({ provider: "opencode-go", model: null, models: null, updatedAt: 1 });
    expect(await currentAgentProvider()).toBe("opencode-go");
  });

  it("env giá trị lạ (kể cả hoa thường/khoảng trắng) được bỏ qua", async () => {
    stubBackend({ provider: null, model: null, models: null, updatedAt: null });
    process.env[PROVIDER_ENV_KEY] = "  OPENROUTER  "; // hợp lệ sau trim/lowercase
    expect(await currentAgentProvider()).toBe("openrouter");
    resetAgentModelCacheForTests();
    process.env[PROVIDER_ENV_KEY] = "anthropic";
    expect(await currentAgentProvider()).toBe("opencode-go");
  });

  it("backend lỗi → env → default opencode-go", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("conn refused"); }));
    expect(await currentAgentProvider()).toBe("opencode-go");
    process.env[PROVIDER_ENV_KEY] = "openrouter";
    resetAgentModelCacheForTests();
    expect(await currentAgentProvider()).toBe("openrouter");
  });

  it("source theo backend → env → default", async () => {
    stubBackend({ provider: "openrouter", model: null, models: null, updatedAt: 1 });
    expect((await currentAgentProviderInfo()).source).toBe("backend");
    resetAgentModelCacheForTests();
    stubBackend({ provider: null, model: null, models: null, updatedAt: null });
    process.env[PROVIDER_ENV_KEY] = "openrouter";
    expect((await currentAgentProviderInfo()).source).toBe("env");
    resetAgentModelCacheForTests();
    delete process.env[PROVIDER_ENV_KEY];
    expect((await currentAgentProviderInfo()).source).toBe("default");
  });
});

describe("currentAgentModel fallback order", () => {
  it("backend có setting hợp lệ → dùng setting (legacy global)", async () => {
    stubBackend({ model: "openai/gpt-4o-mini", updatedAt: 1 });
    process.env[ENV_KEY] = "env/model";
    expect(await currentAgentModel()).toBe("openai/gpt-4o-mini");
  });

  it("setting rác từ backend → coi như chưa cài, rơi về env", async () => {
    stubBackend({ model: "UPPERCASE MODEL; DROP TABLE", updatedAt: 1 });
    process.env[PROVIDER_ENV_KEY] = "openrouter";
    process.env[ENV_KEY] = "env/model";
    expect(await currentAgentModel()).toBe("env/model");
  });

  it("backend chưa cài (model null) → env", async () => {
    stubBackend({ model: null, updatedAt: null });
    process.env[PROVIDER_ENV_KEY] = "openrouter";
    process.env[ENV_KEY] = "env/model";
    expect(await currentAgentModel()).toBe("env/model");
  });

  it("backend lỗi/không reachable → env", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("conn refused"); }));
    process.env[PROVIDER_ENV_KEY] = "openrouter";
    process.env[ENV_KEY] = "env/model";
    expect(await currentAgentModel()).toBe("env/model");
  });

  it("backend lỗi + không env → provider default (opencode-go)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("conn refused"); }));
    expect(await currentAgentModel()).toBe("deepseek-v4.1-flash");
  });

  it("backend lỗi + provider env openrouter + không env model → default openrouter", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("conn refused"); }));
    process.env[PROVIDER_ENV_KEY] = "openrouter";
    expect(await currentAgentModel()).toBe("thinkingmachines/inkling-2-small:free");
  });

  it("backend http không ok + không env → provider default", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect(await currentAgentModel()).toBe("deepseek-v4.1-flash");
  });

  it("go provider dùng SKY_OPENCODE_MODEL khi không có backend", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("conn refused"); }));
    process.env[GO_ENV_KEY] = "go/model";
    expect(await currentAgentModel()).toBe("go/model");
  });

  it("SKY_AGENT_MODEL (global) thắng SKY_OPENCODE_MODEL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("conn refused"); }));
    process.env[GLOBAL_ENV_KEY] = "global/model";
    process.env[GO_ENV_KEY] = "go/model";
    expect(await currentAgentModel()).toBe("global/model");
  });
});

describe("currentAgentModel per-profile", () => {
  it("agent.models[<profile>] thắng legacy và env", async () => {
    stubBackend({
      provider: "opencode-go",
      model: "legacy/model",
      models: { "sky-chat": "chat/model" },
      updatedAt: 1,
    });
    process.env[GLOBAL_ENV_KEY] = "env/model";
    expect(await currentAgentModel("sky-chat")).toBe("chat/model");
    expect(await currentAgentModel("sky-orchestrator")).toBe("legacy/model");
  });

  it("profile không có trong map → legacy → env → default", async () => {
    stubBackend({ provider: "opencode-go", model: null, models: {}, updatedAt: 1 });
    process.env[GLOBAL_ENV_KEY] = "env/model";
    expect(await currentAgentModel("sky-chat")).toBe("env/model");
    resetAgentModelCacheForTests();
    delete process.env[GLOBAL_ENV_KEY];
    expect(await currentAgentModel("sky-chat")).toBe("deepseek-v4.1-flash");
  });

  it("model rác trong map → coi như map chưa cài", async () => {
    stubBackend({ provider: "opencode-go", model: "legacy/model", models: { "sky-chat": "NOT A MODEL!!" }, updatedAt: 1 });
    expect(await currentAgentModel("sky-chat")).toBe("legacy/model");
  });

  it("map không phải object phẳng → bỏ qua", async () => {
    stubBackend({ provider: "opencode-go", model: "legacy/model", models: ["sky-chat"], updatedAt: 1 });
    expect(await currentAgentModel("sky-chat")).toBe("legacy/model");
  });

  it("legacy backend unreachable → lastGood theo profile", async () => {
    vi.useFakeTimers();
    try {
      const ok = okResponse({ provider: "opencode-go", model: "legacy/model", models: { "sky-chat": "chat/model" }, updatedAt: 1 });
      vi.stubGlobal("fetch", vi.fn(async () => ok));
      expect(await currentAgentModel("sky-chat")).toBe("chat/model");
      expect(await currentAgentModel("")).toBe("legacy/model");
      // Backend chết hẳn sau khi hết TTL cache (KHÔNG reset module cache — lastGood phải còn).
      vi.advanceTimersByTime(2100);
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("conn refused"); }));
      expect(await currentAgentModel("sky-chat")).toBe("chat/model");
    } finally {
      vi.useRealTimers();
    }
  });
});
