import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentAgentCore,
  currentAgentCoreInfo,
  resetAgentCoreCacheForTests,
} from "./agent-core.server";
import { resetAgentModelCacheForTests } from "./agent-model.server";

// The core switch is one loopback GET with a fail-safe: anything that is not an explicit `mastra`
// resolves `pi`, so a broken backend (or a hand-edited DB row) can never change the runtime.
describe("currentAgentCore", () => {
  const prevBackend = process.env.BACKEND_URL;

  beforeEach(() => {
    process.env.BACKEND_URL = "http://backend.test";
    resetAgentCoreCacheForTests();
    resetAgentModelCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAgentCoreCacheForTests();
    if (prevBackend === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = prevBackend;
  });

  const json = (body: unknown, ok = true, status = 200) =>
    ({ ok, status, json: async () => body }) as unknown as Response;

  it("reads mastra from the backend", async () => {
    const fetchMock = vi.fn(async (_input: unknown) => json({ core: "mastra", updatedAt: 123 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await currentAgentCore()).toBe("mastra");
    expect(await currentAgentCoreInfo()).toEqual({ core: "mastra", source: "backend" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://backend.test/api/settings/agent-core");
  });

  it("defaults to pi when the row is unset (core: pi / null updatedAt)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ core: "pi", updatedAt: null })));
    expect(await currentAgentCoreInfo()).toEqual({ core: "pi", source: "default" });
  });

  it("defaults to pi on an unreachable backend", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await currentAgentCore()).toBe("pi");
  });

  it("defaults to pi on a non-2xx answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ core: "mastra" }, false, 500)));
    expect(await currentAgentCore()).toBe("pi");
  });

  it("defaults to pi on a garbage payload", async () => {
    for (const body of [{ core: "langgraph" }, { core: 42 }, {}, null, "mastra"]) {
      resetAgentCoreCacheForTests();
      vi.stubGlobal("fetch", vi.fn(async () => json(body)));
      expect(await currentAgentCore()).toBe("pi");
    }
  });

  it("caches the decision for the burst window (one fetch for three reads)", async () => {
    const fetchMock = vi.fn(async () => json({ core: "mastra" }));
    vi.stubGlobal("fetch", fetchMock);
    await currentAgentCore();
    await currentAgentCore();
    await currentAgentCore();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
