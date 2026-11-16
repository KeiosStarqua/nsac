import { describe, expect, it } from "vitest";
import {
  MASTRA_BEDROCK_REGION,
  MASTRA_MAX_OUTPUT_TOKENS,
  mastraModelSpec,
  type MastraModelKeys,
} from "./mastra-model.server";

// Fake keys only — a real key must never reach a test file, a log line or a snapshot.
const KEYS: MastraModelKeys = {
  opencodeGo: "test-go-key",
  openrouter: "test-openrouter-key",
  bedrock: "test-bedrock-token",
};

const EMPTY: MastraModelKeys = { opencodeGo: null, openrouter: null, bedrock: null };

describe("mastraModelSpec — opencode-go", () => {
  it("uses the OpenAI-compatible base url and the direct-provider routing id", () => {
    const r = mastraModelSpec({ provider: "opencode-go", model: "deepseek-v4.1-flash", keys: KEYS });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.modelId).toBe("deepseek-v4.1-flash");
    expect(r.spec).toEqual({
      kind: "openai-compatible",
      id: "opencode-go/deepseek-v4.1-flash",
      // The OpenAI-compatible BASE, never the /chat/completions path (Mastra doc, "Use local models").
      url: "https://opencode.ai/inference/go/openai/v1",
      apiKey: "test-go-key",
    });
  });

  it("honours SKY_OPENCODE_BASE_URL-style overrides and trims them", () => {
    const r = mastraModelSpec({
      provider: "opencode-go",
      model: "m",
      keys: KEYS,
      baseUrls: { opencodeGo: "  http://127.0.0.1:9999/v1  " },
    });
    expect(r.ok && r.spec.kind === "openai-compatible" && r.spec.url).toBe("http://127.0.0.1:9999/v1");
  });

  it("missing key → missing_key sentinel, no spec", () => {
    const r = mastraModelSpec({ provider: "opencode-go", model: "m", keys: EMPTY });
    expect(r).toEqual({ ok: false, reason: "missing_key" });
  });
});

describe("mastraModelSpec — openrouter", () => {
  it("uses the same base url pi-ai uses and the gateway triple id form", () => {
    const r = mastraModelSpec({ provider: "openrouter", model: "thinkingmachines/inkling-2-small:free", keys: KEYS });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // OpenRouter ids already carry their vendor namespace → openrouter/<vendor>/<model>.
    expect(r.spec).toEqual({
      kind: "openai-compatible",
      id: "openrouter/thinkingmachines/inkling-2-small:free",
      url: "https://openrouter.ai/api/v1",
      apiKey: "test-openrouter-key",
    });
  });

  it("honours the base url override", () => {
    const r = mastraModelSpec({
      provider: "openrouter",
      model: "x/y",
      keys: KEYS,
      baseUrls: { openrouter: "http://127.0.0.1:1234/v1" },
    });
    expect(r.ok && r.spec.kind === "openai-compatible" && r.spec.url).toBe("http://127.0.0.1:1234/v1");
  });

  it("missing key → missing_key sentinel", () => {
    expect(mastraModelSpec({ provider: "openrouter", model: "m", keys: EMPTY })).toEqual({
      ok: false,
      reason: "missing_key",
    });
  });
});

describe("mastraModelSpec — amazon-bedrock", () => {
  it("maps to the AI SDK provider spec with the pinned region", () => {
    const r = mastraModelSpec({ provider: "amazon-bedrock", model: "global.amazon.nova-2-lite-v1:0", keys: KEYS });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec).toEqual({
      kind: "bedrock",
      modelId: "global.amazon.nova-2-lite-v1:0",
      apiKey: "test-bedrock-token",
      region: MASTRA_BEDROCK_REGION,
    });
    // Region is pinned — AWS_REGION is deliberately ignored, same rule as the pi core.
    expect(MASTRA_BEDROCK_REGION).toBe("ap-southeast-1");
  });

  it("missing key → missing_key sentinel", () => {
    expect(mastraModelSpec({ provider: "amazon-bedrock", model: "m", keys: EMPTY })).toEqual({
      ok: false,
      reason: "missing_key",
    });
  });
});

describe("max output tokens", () => {
  it("pins 2048 like the pi core", () => {
    expect(MASTRA_MAX_OUTPUT_TOKENS).toBe(2048);
  });
});
