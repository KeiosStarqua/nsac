import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, statSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  openCodeKeyPath,
  readOpenCodeKey,
  openCodeKeySource,
  openCodeKeyFileInfo,
  saveOpenCodeKey,
  clearOpenCodeKeyFile,
} from "./opencode-key.server";

const ENV_KEYS = ["SKY_OPENCODE_API_KEY", "OPENCODE_API_KEY", "NSAC_OPENCODE_KEY_PATH"] as const;
const GOOD_KEY = `oc_sk_${"a".repeat(40)}`;

describe("opencode-key.server", () => {
  let dir: string;
  let keyPath: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    delete process.env.SKY_OPENCODE_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    dir = mkdtempSync(join(tmpdir(), "nsac-opencode-key-"));
    keyPath = join(dir, "sky-opencode.json");
    process.env.NSAC_OPENCODE_KEY_PATH = keyPath;
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("env wins when both env and file are set (SKY_OPENCODE_API_KEY over OPENCODE_API_KEY)", () => {
    writeFileSync(keyPath, JSON.stringify({ key: GOOD_KEY }));
    process.env.OPENCODE_API_KEY = "env-fallback-key-12345";
    process.env.SKY_OPENCODE_API_KEY = "env-primary-key-12345";
    expect(readOpenCodeKey()).toBe("env-primary-key-12345");
    expect(openCodeKeySource()).toBe("env");
  });

  it("OPENCODE_API_KEY is used when SKY_OPENCODE_API_KEY is unset", () => {
    writeFileSync(keyPath, JSON.stringify({ key: GOOD_KEY }));
    process.env.OPENCODE_API_KEY = "env-fallback-key-12345";
    expect(readOpenCodeKey()).toBe("env-fallback-key-12345");
    expect(openCodeKeySource()).toBe("env");
  });

  it("whitespace-only env is treated as unset and the file is used", () => {
    process.env.SKY_OPENCODE_API_KEY = "   ";
    writeFileSync(keyPath, JSON.stringify({ key: GOOD_KEY }));
    expect(readOpenCodeKey()).toBe(GOOD_KEY);
    expect(openCodeKeySource()).toBe("file");
  });

  it("file fallback works with nothing in env", () => {
    expect(readOpenCodeKey()).toBeNull();
    expect(openCodeKeySource()).toBe("none");
    writeFileSync(keyPath, JSON.stringify({ key: GOOD_KEY }));
    expect(readOpenCodeKey()).toBe(GOOD_KEY);
    expect(openCodeKeySource()).toBe("file");
  });

  it("invalid file contents all read as null/none", () => {
    const badContents = [
      "not json{",
      JSON.stringify({ notKey: GOOD_KEY }),
      JSON.stringify({ key: 42 }),
      JSON.stringify({ key: "short" }),
      JSON.stringify({ key: "x".repeat(513) }),
      JSON.stringify({ key: "has space in it 123" }),
      JSON.stringify({ key: "line\nbreak-123456" }),
      JSON.stringify({ key: "tab\tbreak-123456" }),
    ];
    for (const contents of badContents) {
      writeFileSync(keyPath, contents);
      expect(readOpenCodeKey(), contents).toBeNull();
      expect(openCodeKeySource(), contents).toBe("none");
    }
  });

  it("saveOpenCodeKey stores a trimmed key with mode 0600 and flips source to file", () => {
    const result = saveOpenCodeKey(`  ${GOOD_KEY}  `);
    expect(result).toEqual({ ok: true });
    expect(openCodeKeySource()).toBe("file");
    expect(readOpenCodeKey()).toBe(GOOD_KEY);
    const mode = statSync(keyPath).mode & 0o777;
    expect(mode).toBe(0o600);
    // Stored JSON carries the trimmed key, never extra fields.
    expect(JSON.parse(readFileSync(keyPath, "utf8"))).toEqual({ key: GOOD_KEY });
  });

  it("saveOpenCodeKey rejects invalid keys without writing anything", () => {
    const bad: unknown[] = ["short", "x".repeat(513), "has space in it 12345", "line\nbreak12345", "", "   ", 42, null, undefined];
    for (const key of bad) {
      const result = saveOpenCodeKey(key);
      expect(result).toEqual({ ok: false, error: "invalid_key" });
    }
    expect(existsSync(keyPath)).toBe(false);
  });

  it("saveOpenCodeKey creates a missing var dir", () => {
    const nested = join(dir, "var", "nested", "sky-opencode.json");
    process.env.NSAC_OPENCODE_KEY_PATH = nested;
    expect(existsSync(dirname(nested))).toBe(false);
    expect(saveOpenCodeKey(GOOD_KEY)).toEqual({ ok: true });
    expect(readOpenCodeKey()).toBe(GOOD_KEY);
  });

  it("saveOpenCodeKey reports io_error when the path is not writable as a file", () => {
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "occupied");
    process.env.NSAC_OPENCODE_KEY_PATH = join(blocker, "sky-opencode.json"); // mkdir recursive must fail (ENOTDIR)
    expect(saveOpenCodeKey(GOOD_KEY)).toEqual({ ok: false, error: "io_error" });
  });

  it("clearOpenCodeKeyFile is idempotent and removes the stored key", () => {
    expect(() => clearOpenCodeKeyFile()).not.toThrow(); // missing file ⇒ no-op
    saveOpenCodeKey(GOOD_KEY);
    expect(openCodeKeySource()).toBe("file");
    clearOpenCodeKeyFile();
    expect(openCodeKeySource()).toBe("none");
    expect(existsSync(keyPath)).toBe(false);
    expect(() => clearOpenCodeKeyFile()).not.toThrow();
  });

  it("clearOpenCodeKeyFile does not touch the environment", () => {
    process.env.OPENCODE_API_KEY = "env-fallback-key-12345";
    saveOpenCodeKey(GOOD_KEY);
    clearOpenCodeKeyFile();
    expect(openCodeKeySource()).toBe("env");
    expect(readOpenCodeKey()).toBe("env-fallback-key-12345");
  });

  it("openCodeKeyFileInfo reports configured + updatedAt only for a valid file, never the key", () => {
    expect(openCodeKeyFileInfo()).toEqual({ configured: false, updatedAt: null });
    saveOpenCodeKey(GOOD_KEY);
    const info = openCodeKeyFileInfo();
    expect(info.configured).toBe(true);
    expect(typeof info.updatedAt).toBe("number");
    expect(JSON.stringify(info)).not.toContain(GOOD_KEY);
    // An invalid file is not configured even if the stat would succeed.
    writeFileSync(keyPath, "garbage");
    expect(openCodeKeyFileInfo()).toEqual({ configured: false, updatedAt: null });
  });

  it("openCodeKeyPath honors the NSAC_OPENCODE_KEY_PATH override and falls back to cwd/var", () => {
    expect(openCodeKeyPath()).toBe(keyPath);
    delete process.env.NSAC_OPENCODE_KEY_PATH;
    expect(openCodeKeyPath()).toBe(join(process.cwd(), "var", "sky-opencode.json"));
  });
});
