import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeCookieValue } from "../model/admin-auth";

// Same harness as bedrock-key.functions.test.ts: createServerFn is stubbed down to its builder
// chain and the admin cookie is backed by a mutable test cookie. NSAC_LANGFUSE_KEY_PATH points at
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

const { getLangfuseStatusFn, saveLangfuseKeyFn, clearLangfuseKeyFileFn } = await import(
  "./langfuse-key.functions"
);

const SECRET = "test-admin-secret-0123456789";
const GOOD = {
  publicKey: "pk-lf-1234-abcd",
  secretKey: "sk-lf-5678-efgh",
  baseUrl: "https://langfuse.example.test",
};

const LANGFUSE_ENV_KEYS = ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_BASE_URL"] as const;

describe("langfuse-key.functions", () => {
  const originalSecret = process.env.SKY_ADMIN_KEY;
  const originalPath = process.env.NSAC_LANGFUSE_KEY_PATH;
  const originalEnv: Record<string, string | undefined> = {};
  let dir: string;
  let keyPath: string;

  beforeEach(() => {
    process.env.SKY_ADMIN_KEY = SECRET;
    state.cookie = makeCookieValue(SECRET);
    for (const key of LANGFUSE_ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    dir = mkdtempSync(join(tmpdir(), "nsac-langfuse-key-fn-"));
    keyPath = join(dir, "sky-langfuse.json");
    process.env.NSAC_LANGFUSE_KEY_PATH = keyPath;
  });

  afterEach(() => {
    state.cookie = undefined;
    rmSync(dir, { recursive: true, force: true });
    if (originalSecret === undefined) delete process.env.SKY_ADMIN_KEY;
    else process.env.SKY_ADMIN_KEY = originalSecret;
    if (originalPath === undefined) delete process.env.NSAC_LANGFUSE_KEY_PATH;
    else process.env.NSAC_LANGFUSE_KEY_PATH = originalPath;
    for (const key of LANGFUSE_ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("status refuses without the admin cookie", async () => {
    state.cookie = undefined;
    expect(await getLangfuseStatusFn()).toEqual({ status: "unauthorized" });
  });

  it("save refuses without the admin cookie and writes nothing", async () => {
    state.cookie = undefined;
    expect(await saveLangfuseKeyFn({ data: GOOD })).toEqual({ status: "unauthorized" });
    expect(await getLangfuseStatusFn()).toEqual({ status: "unauthorized" });
  });

  it("clear refuses without the admin cookie", async () => {
    state.cookie = undefined;
    expect(await clearLangfuseKeyFileFn()).toEqual({ status: "unauthorized" });
  });

  it("status reports none with nothing configured", async () => {
    expect(await getLangfuseStatusFn()).toEqual({
      status: "ok",
      source: "none",
      updatedAt: null,
      baseUrl: null,
    });
  });

  it("save validation matrix reports the failing field", async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ ...GOOD, publicKey: "pk-" }, "invalid_public_key"],
      [{ ...GOOD, publicKey: "lf-1234" }, "invalid_public_key"],
      [{ ...GOOD, secretKey: "sk-" }, "invalid_secret_key"],
      [{ ...GOOD, secretKey: "pk-lf-1234" }, "invalid_secret_key"],
      [{ ...GOOD, baseUrl: "not a url" }, "invalid_base_url"],
      [{ ...GOOD, baseUrl: "http://langfuse.example.test" }, "invalid_base_url"],
      [{ ...GOOD, baseUrl: "https://user:pass@langfuse.example.test" }, "invalid_base_url"],
      [{ ...GOOD, baseUrl: `https://example.test/${"a".repeat(200)}` }, "invalid_base_url"],
    ];
    for (const [data, expected] of cases) {
      expect(await saveLangfuseKeyFn({ data: data as typeof GOOD }), JSON.stringify(data)).toEqual({
        status: expected,
      });
    }
    expect(await getLangfuseStatusFn()).toEqual({
      status: "ok",
      source: "none",
      updatedAt: null,
      baseUrl: null,
    });
  });

  it("save then status round-trips the stored triple (file source, base URL shown)", async () => {
    expect(await saveLangfuseKeyFn({ data: GOOD })).toEqual({ status: "ok" });
    const info = await getLangfuseStatusFn();
    expect(info.status).toBe("ok");
    if (info.status !== "ok") return;
    expect(info.source).toBe("file");
    expect(info.baseUrl).toBe(GOOD.baseUrl);
    expect(typeof info.updatedAt).toBe("number");
  });

  it("status keeps env precedence and hides the env base URL", async () => {
    process.env.LANGFUSE_PUBLIC_KEY = "pk-env-0001";
    process.env.LANGFUSE_SECRET_KEY = "sk-env-0001";
    process.env.LANGFUSE_BASE_URL = "https://env.example.test";
    expect(await saveLangfuseKeyFn({ data: GOOD })).toEqual({ status: "ok" });
    expect(await getLangfuseStatusFn()).toEqual({
      status: "ok",
      source: "env",
      updatedAt: null,
      baseUrl: null,
    });
    // Clearing the stored triple does not touch the environment.
    expect(await clearLangfuseKeyFileFn()).toEqual({ status: "ok" });
    expect(await getLangfuseStatusFn()).toEqual({
      status: "ok",
      source: "env",
      updatedAt: null,
      baseUrl: null,
    });
  });

  it("clear removes the stored triple and is idempotent", async () => {
    await saveLangfuseKeyFn({ data: GOOD });
    expect(await clearLangfuseKeyFileFn()).toEqual({ status: "ok" });
    expect(await getLangfuseStatusFn()).toEqual({
      status: "ok",
      source: "none",
      updatedAt: null,
      baseUrl: null,
    });
    expect(await clearLangfuseKeyFileFn()).toEqual({ status: "ok" });
  });

  it("save reports io_error when the path cannot hold a file", async () => {
    const { writeFileSync } = await import("node:fs");
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "occupied");
    process.env.NSAC_LANGFUSE_KEY_PATH = join(blocker, "sky-langfuse.json");
    expect(await saveLangfuseKeyFn({ data: GOOD })).toEqual({ status: "io_error" });
  });

  it("neither the save result nor the status payload ever contains a key", async () => {
    const savedResult = await saveLangfuseKeyFn({ data: GOOD });
    const info = await getLangfuseStatusFn();
    for (const payload of [savedResult, info]) {
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain(GOOD.publicKey);
      expect(serialized).not.toContain(GOOD.secretKey);
    }
  });
});
