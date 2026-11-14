import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { HUD_PRESET_EN } from "../../hud-gen/presets";
import {
  composeHud,
  setHudSessionFactory,
  resetHudComposeStateForTests,
} from "./hud-compose.server";

const savedKey = process.env.SKY_OPENROUTER_API_KEY;

function fakeFactory(reply: string | (() => Promise<string>)) {
  const calls: string[] = [];
  const factory = async () => ({
    prompt: async (text: string) => {
      calls.push(text);
      return typeof reply === "function" ? reply() : reply;
    },
    dispose: () => {},
  });
  return { factory, calls };
}

beforeEach(() => {
  process.env.SKY_OPENROUTER_API_KEY = "sk-test-fake";
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.SKY_OPENROUTER_API_KEY;
  else process.env.SKY_OPENROUTER_API_KEY = savedKey;
  setHudSessionFactory(null);
  resetHudComposeStateForTests();
});

describe("composeHud", () => {
  it("returns missing_key without a saved key and never reaches a session", async () => {
    process.env.SKY_OPENROUTER_API_KEY = "";
    const { factory, calls } = fakeFactory("should not be used");
    setHudSessionFactory(factory as never);
    const result = await composeHud("ayla-reyes", "en");
    expect(result).toEqual({ status: "missing_key" });
    expect(calls).toEqual([]);
  });

  it("refuses an unusable astronaut id", async () => {
    const result = await composeHud("../escape", "en");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("refuses an unusable locale", async () => {
    const result = await composeHud("ayla-reyes", "fr");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns the composed program when review passes, then serves it from the 15-min cache", async () => {
    const { factory, calls } = fakeFactory(`Here you go:\n${HUD_PRESET_EN}`);
    setHudSessionFactory(factory as never);
    const first = await composeHud("ayla-reyes", "en");
    expect(first.status).toBe("ok");
    if (first.status === "ok") expect(first.program).toContain("root = Surface(");
    expect(calls.length).toBe(1);
    const second = await composeHud("ayla-reyes", "en");
    expect(second.status).toBe("ok");
    if (second.status === "ok") expect(second.cached).toBe(true);
    expect(calls.length).toBe(1);
  });

  it("caches per astronaut and per locale", async () => {
    const { factory, calls } = fakeFactory(HUD_PRESET_EN);
    setHudSessionFactory(factory as never);
    await composeHud("ayla-reyes", "en");
    await composeHud("ayla-reyes", "vi");
    await composeHud("dae-jung-park", "en");
    expect(calls.length).toBe(3);
  });

  it("returns rejected when the program fails review, and does not cache the rejection", async () => {
    const { factory, calls } = fakeFactory("root = Surface([bogus])\nbogus = Frobnicate()");
    setHudSessionFactory(factory as never);
    const first = await composeHud("ayla-reyes", "en");
    expect(first.status).toBe("rejected");
    const second = await composeHud("ayla-reyes", "en");
    expect(second.status).toBe("rejected");
    expect(calls.length).toBe(2);
  });

  it("an empty model reply rejects as well", async () => {
    const { factory } = fakeFactory("");
    setHudSessionFactory(factory as never);
    const result = await composeHud("ayla-reyes", "en");
    expect(result.status).toBe("rejected");
  });
});
