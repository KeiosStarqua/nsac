import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, statSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  langfuseKeyPath,
  readLangfuseConfig,
  langfuseKeySource,
  langfuseFileInfo,
  validateLangfuseConfig,
  saveLangfuseConfig,
  clearLangfuseKeyFile,
} from "./langfuse-key.server";

const ENV_KEYS = [
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "LANGFUSE_BASE_URL",
  "LANGFUSE_ENVIRONMENT",
  "LANGFUSE_RELEASE",
  "NSAC_LANGFUSE_KEY_PATH",
] as const;

const GOOD = {
  publicKey: "pk-lf-1234-abcd",
  secretKey: "sk-lf-5678-efgh",
  baseUrl: "https://langfuse.example.test",
};

function writeFile(path: string, config: { publicKey?: unknown; secretKey?: unknown; baseUrl?: unknown }) {
  writeFileSync(path, JSON.stringify({ ...config, savedAt: Date.now() }));
}

function setEnv(config: { publicKey?: string; secretKey?: string; baseUrl?: string }) {
  if (config.publicKey !== undefined) process.env.LANGFUSE_PUBLIC_KEY = config.publicKey;
  if (config.secretKey !== undefined) process.env.LANGFUSE_SECRET_KEY = config.secretKey;
  if (config.baseUrl !== undefined) process.env.LANGFUSE_BASE_URL = config.baseUrl;
}

describe("langfuse-key.server", () => {
  let dir: string;
  let keyPath: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_BASE_URL;
    delete process.env.LANGFUSE_ENVIRONMENT;
    delete process.env.LANGFUSE_RELEASE;
    dir = mkdtempSync(join(tmpdir(), "nsac-langfuse-key-"));
    keyPath = join(dir, "sky-langfuse.json");
    process.env.NSAC_LANGFUSE_KEY_PATH = keyPath;
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("stores the whole triple atomically and reads it back", () => {
    expect(readLangfuseConfig()).toBeNull();
    expect(langfuseKeySource()).toBe("none");

    expect(saveLangfuseConfig(GOOD)).toEqual({ ok: true });

    expect(readLangfuseConfig()).toEqual(GOOD);
    expect(langfuseKeySource()).toBe("file");

    const mode = statSync(keyPath).mode & 0o777;
    expect(mode).toBe(0o600);
    const stored = JSON.parse(readFileSync(keyPath, "utf8"));
    expect(stored).toMatchObject(GOOD);
    expect(typeof stored.savedAt).toBe("number");
  });

  it("trims the inputs before storing", () => {
    expect(
      saveLangfuseConfig({
        publicKey: `  ${GOOD.publicKey}  `,
        secretKey: `\n${GOOD.secretKey}\t`,
        baseUrl: `  ${GOOD.baseUrl}  `,
      }),
    ).toEqual({ ok: true });
    expect(readLangfuseConfig()).toEqual(GOOD);
  });

  it("clearLangfuseKeyFile deletes the file and is idempotent", () => {
    expect(() => clearLangfuseKeyFile()).not.toThrow(); // missing file ⇒ no-op
    saveLangfuseConfig(GOOD);
    expect(langfuseKeySource()).toBe("file");

    clearLangfuseKeyFile();
    expect(langfuseKeySource()).toBe("none");
    expect(existsSync(keyPath)).toBe(false);
    expect(readLangfuseConfig()).toBeNull();
    expect(() => clearLangfuseKeyFile()).not.toThrow();
  });

  it("clearLangfuseKeyFile never touches the environment", () => {
    saveLangfuseConfig(GOOD);
    setEnv(GOOD);
    clearLangfuseKeyFile();
    expect(langfuseKeySource()).toBe("env");
    expect(readLangfuseConfig()).toEqual(GOOD);
  });

  it("env wins as a whole triple when both env and file are complete", () => {
    writeFile(keyPath, GOOD);
    setEnv({ publicKey: "pk-env-0001", secretKey: "sk-env-0001", baseUrl: "https://env.example.test" });

    expect(readLangfuseConfig()).toEqual({
      publicKey: "pk-env-0001",
      secretKey: "sk-env-0001",
      baseUrl: "https://env.example.test",
    });
    expect(langfuseKeySource()).toBe("env");
  });

  it("a half-present environment loses to a complete stored file (no per-variable mixing)", () => {
    writeFile(keyPath, GOOD);
    // Only the base URL is set in env: the file must supply the whole triple, not just the keys.
    setEnv({ baseUrl: "https://env.example.test" });

    expect(readLangfuseConfig()).toEqual(GOOD);
    expect(langfuseKeySource()).toBe("file");
  });

  it("whitespace-only env values count as missing", () => {
    writeFile(keyPath, GOOD);
    setEnv({ publicKey: "   ", secretKey: "  ", baseUrl: " " });
    expect(readLangfuseConfig()).toEqual(GOOD);
    expect(langfuseKeySource()).toBe("file");
  });

  it("a complete environment without a stored file is enough", () => {
    setEnv(GOOD);
    expect(readLangfuseConfig()).toEqual(GOOD);
    expect(langfuseKeySource()).toBe("env");
  });

  it("carries LANGFUSE_ENVIRONMENT / LANGFUSE_RELEASE from env only, never from the file", () => {
    saveLangfuseConfig(GOOD);
    expect(readLangfuseConfig()).not.toHaveProperty("environment");
    expect(readLangfuseConfig()).not.toHaveProperty("release");

    process.env.LANGFUSE_ENVIRONMENT = "staging";
    process.env.LANGFUSE_RELEASE = "sha-abc";
    expect(readLangfuseConfig()).toEqual({
      ...GOOD,
      environment: "staging",
      release: "sha-abc",
    });
  });

  it("a missing or empty file reads as not configured", () => {
    expect(readLangfuseConfig()).toBeNull();
    expect(langfuseKeySource()).toBe("none");

    writeFileSync(keyPath, "");
    expect(readLangfuseConfig()).toBeNull();
    expect(langfuseKeySource()).toBe("none");

    writeFileSync(keyPath, "not json{");
    expect(readLangfuseConfig()).toBeNull();
    expect(langfuseKeySource()).toBe("none");
  });

  it("an incomplete stored file reads as not configured", () => {
    for (const partial of [
      { publicKey: GOOD.publicKey },
      { publicKey: GOOD.publicKey, secretKey: GOOD.secretKey },
      { secretKey: GOOD.secretKey, baseUrl: GOOD.baseUrl },
      { publicKey: GOOD.publicKey, secretKey: GOOD.secretKey, baseUrl: 42 },
    ]) {
      writeFileSync(keyPath, JSON.stringify(partial));
      expect(readLangfuseConfig(), JSON.stringify(partial)).toBeNull();
      expect(langfuseKeySource(), JSON.stringify(partial)).toBe("none");
    }
  });

  it("validation matrix rejects bad public keys, secret keys and base URLs", () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ ...GOOD, publicKey: "pk-" }, "invalid_public_key"],
      [{ ...GOOD, publicKey: "lf-1234" }, "invalid_public_key"],
      [{ ...GOOD, publicKey: `pk-${"a".repeat(229)}` }, "invalid_public_key"],
      [{ ...GOOD, publicKey: "pk has space 1234" }, "invalid_public_key"],
      [{ ...GOOD, secretKey: "sk-" }, "invalid_secret_key"],
      [{ ...GOOD, secretKey: "pk-lf-1234-abcd" }, "invalid_secret_key"],
      [{ ...GOOD, secretKey: `sk-${"a".repeat(229)}` }, "invalid_secret_key"],
      [{ ...GOOD, baseUrl: "not a url" }, "invalid_base_url"],
      [{ ...GOOD, baseUrl: "langfuse.example.test" }, "invalid_base_url"],
      [{ ...GOOD, baseUrl: "ftp://langfuse.example.test" }, "invalid_base_url"],
      [{ ...GOOD, baseUrl: "http://langfuse.example.test" }, "invalid_base_url"],
      [{ ...GOOD, baseUrl: "https://user:pass@langfuse.example.test" }, "invalid_base_url"],
      [{ ...GOOD, baseUrl: `https://example.test/${"a".repeat(200)}` }, "invalid_base_url"],
      [{ ...GOOD, baseUrl: "" }, "invalid_base_url"],
    ];
    for (const [input, expected] of cases) {
      expect(validateLangfuseConfig(input), JSON.stringify(input)).toEqual({ ok: false, error: expected });
      expect(saveLangfuseConfig(input), JSON.stringify(input)).toEqual({ ok: false, error: "invalid" });
    }
    expect(existsSync(keyPath)).toBe(false);
  });

  it("rejects non-object input without throwing", () => {
    for (const input of [null, undefined, 42, "pk-lf-1234", []]) {
      expect(saveLangfuseConfig(input)).toEqual({ ok: false, error: "invalid" });
    }
  });

  it("accepts a local http base URL for dev and keeps the URL as entered", () => {
    for (const baseUrl of [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://[::1]:3000",
      "https://langfuse.openfarmgroup.com",
      "https://langfuse.example.test/prefix",
    ]) {
      const result = saveLangfuseConfig({ ...GOOD, baseUrl });
      expect(result, baseUrl).toEqual({ ok: true });
      expect(readLangfuseConfig()?.baseUrl, baseUrl).toBe(baseUrl);
    }
  });

  it("saveLangfuseConfig creates a missing var dir and reports io_error when the path is blocked", () => {
    const nested = join(dir, "var", "nested", "sky-langfuse.json");
    process.env.NSAC_LANGFUSE_KEY_PATH = nested;
    expect(existsSync(dirname(nested))).toBe(false);
    expect(saveLangfuseConfig(GOOD)).toEqual({ ok: true });
    expect(readLangfuseConfig()).toEqual(GOOD);

    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "occupied");
    process.env.NSAC_LANGFUSE_KEY_PATH = join(blocker, "sky-langfuse.json"); // mkdir recursive fails (ENOTDIR)
    expect(saveLangfuseConfig(GOOD)).toEqual({ ok: false, error: "io_error" });
  });

  it("langfuseFileInfo reports configured/updatedAt/baseUrl only, never a key", () => {
    expect(langfuseFileInfo()).toEqual({ configured: false, updatedAt: null, baseUrl: null });

    saveLangfuseConfig(GOOD);
    const info = langfuseFileInfo();
    expect(info.configured).toBe(true);
    expect(typeof info.updatedAt).toBe("number");
    expect(info.baseUrl).toBe(GOOD.baseUrl);
    const serialized = JSON.stringify(info);
    expect(serialized).not.toContain(GOOD.publicKey);
    expect(serialized).not.toContain(GOOD.secretKey);

    // Source from env: the hint still comes from the file only, and reports the file's URL.
    setEnv({ publicKey: "pk-env-0001", secretKey: "sk-env-0001", baseUrl: "https://env.example.test" });
    expect(langfuseFileInfo().baseUrl).toBe(GOOD.baseUrl);

    writeFileSync(keyPath, "garbage");
    expect(langfuseFileInfo()).toEqual({ configured: false, updatedAt: null, baseUrl: null });
  });

  it("langfuseKeyPath honors NSAC_LANGFUSE_KEY_PATH and defaults to cwd/var", () => {
    expect(langfuseKeyPath()).toBe(keyPath);
    delete process.env.NSAC_LANGFUSE_KEY_PATH;
    expect(langfuseKeyPath()).toBe(join(process.cwd(), "var", "sky-langfuse.json"));
  });
});
