import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  currentAgentModel,
  modelChanged,
  resetAgentModelCacheForTests,
} from "./agent-model.server";

// agent-model.server tự fetch backend (BACKEND_URL, mặc định 127.0.0.1:3200) với timeout ~1.2s.
// Mọi test ở đây stub global fetch nên không bao giờ chạm mạng/DB thật.
const ENV_KEY = "SKY_OPENROUTER_MODEL";
const BACKEND_KEY = "BACKEND_URL";

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => {
  resetAgentModelCacheForTests();
  process.env[BACKEND_KEY] = "http://127.0.0.1:1";
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetAgentModelCacheForTests();
  delete process.env[BACKEND_KEY];
  delete process.env[ENV_KEY];
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

describe("currentAgentModel fallback order", () => {
  it("backend có setting hợp lệ → dùng setting", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ model: "openai/gpt-4o-mini", updatedAt: 1 })));
    process.env[ENV_KEY] = "env/model";
    expect(await currentAgentModel()).toBe("openai/gpt-4o-mini");
  });

  it("setting rác từ backend → coi như chưa cài, rơi về env", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ model: "UPPERCASE MODEL; DROP TABLE", updatedAt: 1 })));
    process.env[ENV_KEY] = "env/model";
    expect(await currentAgentModel()).toBe("env/model");
  });

  it("backend chưa cài (model null) → env", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ model: null, updatedAt: null })));
    process.env[ENV_KEY] = "env/model";
    expect(await currentAgentModel()).toBe("env/model");
  });

  it("backend lỗi/không reachable → env", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("conn refused"); }));
    process.env[ENV_KEY] = "env/model";
    expect(await currentAgentModel()).toBe("env/model");
  });

  it("backend lỗi + không env → hardcoded default", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("conn refused"); }));
    expect(await currentAgentModel()).toBe("thinkingmachines/inkling-2-small:free");
  });

  it("backend http không ok + không env → hardcoded default", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect(await currentAgentModel()).toBe("thinkingmachines/inkling-2-small:free");
  });
});
