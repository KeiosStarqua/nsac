import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeCookieValue } from "../model/admin-auth";

// Same harness as opencode-key.functions.test.ts: createServerFn is stubbed down to its builder
// chain and the admin cookie is backed by a mutable test cookie. NSAC_BEDROCK_KEY_PATH points at
// a fresh tmp dir per test so the real var/ is never touched.
const state = vi.hoisted(() => ({ cookie: undefined as string | undefined }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const build = (): Record<string, unknown> => ({
      validator: () => build(),
      handler: (fn: (ctx: { data?: unknown }) => unknown) => (ctx?: { data?: unknown }) =>
        fn({ data: ctx?.data }),
    });
    return build();
  },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: () => state.cookie,
  setCookie: () => {},
  getRequestProtocol: () => "http",
}));

const { getBedrockKeyInfoFn, saveBedrockKeyFn, clearBedrockKeyFn } = await import("./bedrock-key.functions");

const SECRET = "test-admin-secret-0123456789";
const FAKE_KEY = `AQ${"a".repeat(64)}`;

describe("bedrock-key.functions", () => {
  const originalSecret = process.env.SKY_ADMIN_KEY;
  const originalPath = process.env.NSAC_BEDROCK_KEY_PATH;
  const originalBedrock = process.env.AWS_BEARER_TOKEN_BEDROCK;
  let dir: string;
  let keyPath: string;

  beforeEach(() => {
    process.env.SKY_ADMIN_KEY = SECRET;
    state.cookie = makeCookieValue(SECRET);
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    dir = mkdtempSync(join(tmpdir(), "nsac-bedrock-key-fn-"));
    keyPath = join(dir, "sky-bedrock.json");
    process.env.NSAC_BEDROCK_KEY_PATH = keyPath;
  });

  afterEach(() => {
    state.cookie = undefined;
    rmSync(dir, { recursive: true, force: true });
    if (originalSecret === undefined) delete process.env.SKY_ADMIN_KEY;
    else process.env.SKY_ADMIN_KEY = originalSecret;
    if (originalPath === undefined) delete process.env.NSAC_BEDROCK_KEY_PATH;
    else process.env.NSAC_BEDROCK_KEY_PATH = originalPath;
    if (originalBedrock === undefined) delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    else process.env.AWS_BEARER_TOKEN_BEDROCK = originalBedrock;
  });

  it("info refuses without the admin cookie", async () => {
    state.cookie = undefined;
    expect(await getBedrockKeyInfoFn()).toEqual({ status: "unauthorized" });
  });

  it("save refuses without the admin cookie and writes nothing", async () => {
    state.cookie = undefined;
    expect(await saveBedrockKeyFn({ data: { key: FAKE_KEY } })).toEqual({ status: "unauthorized" });
    expect(await getBedrockKeyInfoFn()).toEqual({ status: "unauthorized" });
  });

  it("clear refuses without the admin cookie", async () => {
    state.cookie = undefined;
    expect(await clearBedrockKeyFn()).toEqual({ status: "unauthorized" });
  });

  it("info reports none with nothing configured", async () => {
    expect(await getBedrockKeyInfoFn()).toEqual({ status: "ok", source: "none", updatedAt: null });
  });

  it("save validation matrix", async () => {
    const cases: Array<[string, string]> = [
      ["short", "invalid_key"],
      ["x".repeat(4097), "invalid_key"],
      ["has space inside 123", "invalid_key"],
      ["line\nbreak-123456", "invalid_key"],
      ["tab\tbreak-123456", "invalid_key"],
      ["   ", "invalid_key"],
    ];
    for (const [key, expected] of cases) {
      expect(await saveBedrockKeyFn({ data: { key } }), JSON.stringify(key)).toEqual({ status: expected });
    }
    expect(await getBedrockKeyInfoFn()).toEqual({ status: "ok", source: "none", updatedAt: null });
  });

  it("save accepts a JWT-scale token and info then reports source=file with updatedAt", async () => {
    const big = `header.${"b".repeat(1500)}.${"c".repeat(400)}`;
    expect(await saveBedrockKeyFn({ data: { key: big } })).toEqual({ status: "ok" });
    const info = await getBedrockKeyInfoFn();
    expect(info.status).toBe("ok");
    if (info.status !== "ok") return;
    expect(info.source).toBe("file");
    expect(typeof info.updatedAt).toBe("number");
  });

  it("save preserves env precedence over a stored token", async () => {
    process.env.AWS_BEARER_TOKEN_BEDROCK = "env-bedrock-token-12345";
    expect(await saveBedrockKeyFn({ data: { key: FAKE_KEY } })).toEqual({ status: "ok" });
    const info = await getBedrockKeyInfoFn();
    expect(info).toEqual({ status: "ok", source: "env", updatedAt: null });
    // Clearing the stored token does not touch the environment.
    expect(await clearBedrockKeyFn()).toEqual({ status: "ok" });
    expect(await getBedrockKeyInfoFn()).toEqual({ status: "ok", source: "env", updatedAt: null });
  });

  it("clear removes the stored token and is idempotent", async () => {
    await saveBedrockKeyFn({ data: { key: FAKE_KEY } });
    expect(await clearBedrockKeyFn()).toEqual({ status: "ok" });
    expect(await getBedrockKeyInfoFn()).toEqual({ status: "ok", source: "none", updatedAt: null });
    expect(await clearBedrockKeyFn()).toEqual({ status: "ok" });
  });

  it("save reports io_error when the path cannot hold a file", async () => {
    const { writeFileSync } = await import("node:fs");
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "occupied");
    process.env.NSAC_BEDROCK_KEY_PATH = join(blocker, "sky-bedrock.json");
    expect(await saveBedrockKeyFn({ data: { key: FAKE_KEY } })).toEqual({ status: "io_error" });
  });

  it("neither the save result nor the info payload ever contains the token", async () => {
    const savedResult = await saveBedrockKeyFn({ data: { key: FAKE_KEY } });
    const info = await getBedrockKeyInfoFn();
    expect(JSON.stringify(savedResult)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(info)).not.toContain(FAKE_KEY);
  });
});
