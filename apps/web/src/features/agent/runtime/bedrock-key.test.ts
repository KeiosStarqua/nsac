import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, statSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  bedrockKeyPath,
  readBedrockKey,
  bedrockKeySource,
  bedrockKeyFileInfo,
  saveBedrockKey,
  clearBedrockKeyFile,
} from "./bedrock-key.server";

const ENV_KEYS = ["AWS_BEARER_TOKEN_BEDROCK", "NSAC_BEDROCK_KEY_PATH"] as const;
const GOOD_KEY = `AQ${"a".repeat(64)}`;

describe("bedrock-key.server", () => {
  let dir: string;
  let keyPath: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    dir = mkdtempSync(join(tmpdir(), "nsac-bedrock-key-"));
    keyPath = join(dir, "sky-bedrock.json");
    process.env.NSAC_BEDROCK_KEY_PATH = keyPath;
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("env wins when both env and file are set", () => {
    writeFileSync(keyPath, JSON.stringify({ key: GOOD_KEY }));
    process.env.AWS_BEARER_TOKEN_BEDROCK = "env-bedrock-token-12345";
    expect(readBedrockKey()).toBe("env-bedrock-token-12345");
    expect(bedrockKeySource()).toBe("env");
  });

  it("whitespace-only env is treated as unset and the file is used", () => {
    process.env.AWS_BEARER_TOKEN_BEDROCK = "   ";
    writeFileSync(keyPath, JSON.stringify({ key: GOOD_KEY }));
    expect(readBedrockKey()).toBe(GOOD_KEY);
    expect(bedrockKeySource()).toBe("file");
  });

  it("file fallback works with nothing in env", () => {
    expect(readBedrockKey()).toBeNull();
    expect(bedrockKeySource()).toBe("none");
    writeFileSync(keyPath, JSON.stringify({ key: GOOD_KEY }));
    expect(readBedrockKey()).toBe(GOOD_KEY);
    expect(bedrockKeySource()).toBe("file");
  });

  it("a JWT-scale token (2 KB) round-trips through save and read", () => {
    const big = `header.${"b".repeat(1500)}.${"c".repeat(400)}`;
    expect(saveBedrockKey(big)).toEqual({ ok: true });
    expect(readBedrockKey()).toBe(big);
    expect(bedrockKeySource()).toBe("file");
  });

  it("invalid file contents all read as null/none", () => {
    const badContents = [
      "not json{",
      JSON.stringify({ notKey: GOOD_KEY }),
      JSON.stringify({ key: 42 }),
      JSON.stringify({ key: "short" }),
      JSON.stringify({ key: "x".repeat(4097) }),
      JSON.stringify({ key: "has space in it 123" }),
      JSON.stringify({ key: "line\nbreak-123456" }),
      JSON.stringify({ key: "tab\tbreak-123456" }),
    ];
    for (const contents of badContents) {
      writeFileSync(keyPath, contents);
      expect(readBedrockKey(), contents).toBeNull();
      expect(bedrockKeySource(), contents).toBe("none");
    }
  });

  it("saveBedrockKey stores a trimmed token with mode 0600 and flips source to file", () => {
    const result = saveBedrockKey(`  ${GOOD_KEY}  `);
    expect(result).toEqual({ ok: true });
    expect(bedrockKeySource()).toBe("file");
    expect(readBedrockKey()).toBe(GOOD_KEY);
    const mode = statSync(keyPath).mode & 0o777;
    expect(mode).toBe(0o600);
    // Stored JSON carries the trimmed token, never extra fields.
    expect(JSON.parse(readFileSync(keyPath, "utf8"))).toEqual({ key: GOOD_KEY });
  });

  it("saveBedrockKey rejects invalid tokens without writing anything", () => {
    const bad: unknown[] = ["short", "x".repeat(4097), "has space in it 12345", "line\nbreak12345", "", "   ", 42, null, undefined];
    for (const key of bad) {
      const result = saveBedrockKey(key);
      expect(result).toEqual({ ok: false, error: "invalid_key" });
    }
    expect(existsSync(keyPath)).toBe(false);
  });

  it("saveBedrockKey creates a missing var dir", () => {
    const nested = join(dir, "var", "nested", "sky-bedrock.json");
    process.env.NSAC_BEDROCK_KEY_PATH = nested;
    expect(existsSync(dirname(nested))).toBe(false);
    expect(saveBedrockKey(GOOD_KEY)).toEqual({ ok: true });
    expect(readBedrockKey()).toBe(GOOD_KEY);
  });

  it("saveBedrockKey reports io_error when the path is not writable as a file", () => {
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "occupied");
    process.env.NSAC_BEDROCK_KEY_PATH = join(blocker, "sky-bedrock.json"); // mkdir recursive must fail (ENOTDIR)
    expect(saveBedrockKey(GOOD_KEY)).toEqual({ ok: false, error: "io_error" });
  });

  it("clearBedrockKeyFile is idempotent and removes the stored token", () => {
    expect(() => clearBedrockKeyFile()).not.toThrow(); // missing file ⇒ no-op
    saveBedrockKey(GOOD_KEY);
    expect(bedrockKeySource()).toBe("file");
    clearBedrockKeyFile();
    expect(bedrockKeySource()).toBe("none");
    expect(existsSync(keyPath)).toBe(false);
    expect(() => clearBedrockKeyFile()).not.toThrow();
  });

  it("clearBedrockKeyFile does not touch the environment", () => {
    process.env.AWS_BEARER_TOKEN_BEDROCK = "env-bedrock-token-12345";
    saveBedrockKey(GOOD_KEY);
    clearBedrockKeyFile();
    expect(bedrockKeySource()).toBe("env");
    expect(readBedrockKey()).toBe("env-bedrock-token-12345");
  });

  it("bedrockKeyFileInfo reports configured + updatedAt only for a valid file, never the token", () => {
    expect(bedrockKeyFileInfo()).toEqual({ configured: false, updatedAt: null });
    saveBedrockKey(GOOD_KEY);
    const info = bedrockKeyFileInfo();
    expect(info.configured).toBe(true);
    expect(typeof info.updatedAt).toBe("number");
    expect(JSON.stringify(info)).not.toContain(GOOD_KEY);
    // An invalid file is not configured even if the stat would succeed.
    writeFileSync(keyPath, "garbage");
    expect(bedrockKeyFileInfo()).toEqual({ configured: false, updatedAt: null });
  });

  it("bedrockKeyPath honors the NSAC_BEDROCK_KEY_PATH override and falls back to cwd/var", () => {
    expect(bedrockKeyPath()).toBe(keyPath);
    delete process.env.NSAC_BEDROCK_KEY_PATH;
    expect(bedrockKeyPath()).toBe(join(process.cwd(), "var", "sky-bedrock.json"));
  });
});
