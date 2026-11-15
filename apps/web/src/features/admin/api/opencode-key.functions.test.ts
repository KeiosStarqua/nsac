import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeCookieValue } from "../model/admin-auth";

// Same harness as elevenlabs.functions.test.ts: createServerFn is stubbed down to its builder
// chain and the admin cookie is backed by a mutable test cookie. NSAC_OPENCODE_KEY_PATH points at
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

const { getOpenCodeKeyInfoFn, saveOpenCodeKeyFn, clearOpenCodeKeyFn } = await import("./opencode-key.functions");

const SECRET = "test-admin-secret-0123456789";
const FAKE_KEY = `oc_sk_${"a".repeat(40)}`;

describe("opencode-key.functions", () => {
  const originalSecret = process.env.SKY_ADMIN_KEY;
  const originalPath = process.env.NSAC_OPENCODE_KEY_PATH;
  const originalGoKey = process.env.SKY_OPENCODE_API_KEY;
  const originalFallback = process.env.OPENCODE_API_KEY;
  let dir: string;
  let keyPath: string;

  beforeEach(() => {
    process.env.SKY_ADMIN_KEY = SECRET;
    state.cookie = makeCookieValue(SECRET);
    delete process.env.SKY_OPENCODE_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    dir = mkdtempSync(join(tmpdir(), "nsac-opencode-key-fn-"));
    keyPath = join(dir, "sky-opencode.json");
    process.env.NSAC_OPENCODE_KEY_PATH = keyPath;
  });

  afterEach(() => {
    state.cookie = undefined;
    rmSync(dir, { recursive: true, force: true });
    if (originalSecret === undefined) delete process.env.SKY_ADMIN_KEY;
    else process.env.SKY_ADMIN_KEY = originalSecret;
    if (originalPath === undefined) delete process.env.NSAC_OPENCODE_KEY_PATH;
    else process.env.NSAC_OPENCODE_KEY_PATH = originalPath;
    if (originalGoKey === undefined) delete process.env.SKY_OPENCODE_API_KEY;
    else process.env.SKY_OPENCODE_API_KEY = originalGoKey;
    if (originalFallback === undefined) delete process.env.OPENCODE_API_KEY;
    else process.env.OPENCODE_API_KEY = originalFallback;
  });

  it("info refuses without the admin cookie", async () => {
    state.cookie = undefined;
    expect(await getOpenCodeKeyInfoFn()).toEqual({ status: "unauthorized" });
  });

  it("save refuses without the admin cookie and writes nothing", async () => {
    state.cookie = undefined;
    expect(await saveOpenCodeKeyFn({ data: { key: FAKE_KEY } })).toEqual({ status: "unauthorized" });
    expect(await getOpenCodeKeyInfoFn()).toEqual({ status: "unauthorized" });
  });

  it("clear refuses without the admin cookie", async () => {
    state.cookie = undefined;
    expect(await clearOpenCodeKeyFn()).toEqual({ status: "unauthorized" });
  });

  it("info reports none with nothing configured", async () => {
    expect(await getOpenCodeKeyInfoFn()).toEqual({ status: "ok", source: "none", updatedAt: null });
  });

  it("save validation matrix", async () => {
    const cases: Array<[string, string]> = [
      ["short", "invalid_key"],
      ["x".repeat(513), "invalid_key"],
      ["has space inside 123", "invalid_key"],
      ["line\nbreak-123456", "invalid_key"],
      ["tab\tbreak-123456", "invalid_key"],
      ["   ", "invalid_key"],
    ];
    for (const [key, expected] of cases) {
      expect(await saveOpenCodeKeyFn({ data: { key } }), JSON.stringify(key)).toEqual({ status: expected });
    }
    expect(await getOpenCodeKeyInfoFn()).toEqual({ status: "ok", source: "none", updatedAt: null });
  });

  it("save accepts a printable key and info then reports source=file with updatedAt", async () => {
    expect(await saveOpenCodeKeyFn({ data: { key: FAKE_KEY } })).toEqual({ status: "ok" });
    const info = await getOpenCodeKeyInfoFn();
    expect(info.status).toBe("ok");
    if (info.status !== "ok") return;
    expect(info.source).toBe("file");
    expect(typeof info.updatedAt).toBe("number");
  });

  it("save preserves env precedence over a stored key", async () => {
    process.env.SKY_OPENCODE_API_KEY = "env-primary-key-12345";
    expect(await saveOpenCodeKeyFn({ data: { key: FAKE_KEY } })).toEqual({ status: "ok" });
    const info = await getOpenCodeKeyInfoFn();
    expect(info).toEqual({ status: "ok", source: "env", updatedAt: null });
    // Clearing the stored key does not touch the environment.
    expect(await clearOpenCodeKeyFn()).toEqual({ status: "ok" });
    expect(await getOpenCodeKeyInfoFn()).toEqual({ status: "ok", source: "env", updatedAt: null });
  });

  it("clear removes the stored key and is idempotent", async () => {
    await saveOpenCodeKeyFn({ data: { key: FAKE_KEY } });
    expect(await clearOpenCodeKeyFn()).toEqual({ status: "ok" });
    expect(await getOpenCodeKeyInfoFn()).toEqual({ status: "ok", source: "none", updatedAt: null });
    expect(await clearOpenCodeKeyFn()).toEqual({ status: "ok" });
  });

  it("save reports io_error when the path cannot hold a file", async () => {
    const { writeFileSync } = await import("node:fs");
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "occupied");
    process.env.NSAC_OPENCODE_KEY_PATH = join(blocker, "sky-opencode.json");
    expect(await saveOpenCodeKeyFn({ data: { key: FAKE_KEY } })).toEqual({ status: "io_error" });
  });

  it("neither the save result nor the info payload ever contains the key", async () => {
    const savedResult = await saveOpenCodeKeyFn({ data: { key: FAKE_KEY } });
    const info = await getOpenCodeKeyInfoFn();
    expect(JSON.stringify(savedResult)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(info)).not.toContain(FAKE_KEY);
  });
});
