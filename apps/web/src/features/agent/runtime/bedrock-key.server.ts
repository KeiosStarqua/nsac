import "@tanstack/react-start/server-only";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, renameSync, chmodSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * AWS Bedrock bearer-token store — write-only, mirrors the `var/sky-opencode.json` precedent.
 *
 * Resolution order for every reader: box env wins (`AWS_BEARER_TOKEN_BEDROCK`), then the stored
 * file (`var/sky-bedrock.json`, mode 0600, gitignored). The file is written only through
 * `saveBedrockKey` (admin panel) and never read back to any client surface — every export here is
 * either a boolean/source label or throws nothing; no function returns the token's value to a
 * browser path.
 *
 * Bedrock stays region-pinned to ap-southeast-1: the region is NOT configurable here. Override the
 * runtime base URL on the host with `SKY_BEDROCK_BASE_URL` instead (see `bedrockBaseUrl()` in
 * pi.server.ts) — `AWS_REGION` is deliberately ignored, matching the pinned-region contract.
 *
 * Override the file location with `NSAC_BEDROCK_KEY_PATH` (tests, scratch deployments).
 */

// Printable ASCII, no space/control chars, 8..4096 — AWS bearer tokens (`aws login` session JWTs)
// run to a few KB, so the OpenCode 512 ceiling does not fit here.
const KEY_REGEX = /^[!-~]{8,4096}$/;

export function bedrockKeyPath(): string {
  const override = process.env.NSAC_BEDROCK_KEY_PATH?.trim();
  return override && override.length > 0 ? override : join(process.cwd(), "var", "sky-bedrock.json");
}

function envKey(): string | null {
  const raw = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readFileKey(): string | null {
  try {
    const raw = readFileSync(bedrockKeyPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const key = (parsed as { key?: unknown })?.key;
    if (typeof key !== "string") return null;
    const trimmed = key.trim();
    return KEY_REGEX.test(trimmed) ? trimmed : null;
  } catch {
    // Missing file, invalid JSON, wrong shape, bad token — all mean "not configured".
    return null;
  }
}

export function readBedrockKey(): string | null {
  return envKey() ?? readFileKey();
}

export function bedrockKeySource(): "env" | "file" | "none" {
  if (envKey() !== null) return "env";
  if (readFileKey() !== null) return "file";
  return "none";
}

export function bedrockKeyFileInfo(): { configured: boolean; updatedAt: number | null } {
  if (readFileKey() === null) return { configured: false, updatedAt: null };
  try {
    return { configured: true, updatedAt: statSync(bedrockKeyPath()).mtimeMs };
  } catch {
    return { configured: false, updatedAt: null };
  }
}

export type SaveBedrockKeyResult = { ok: true } | { ok: false; error: "invalid_key" | "io_error" };

export function saveBedrockKey(key: unknown): SaveBedrockKeyResult {
  if (typeof key !== "string") return { ok: false, error: "invalid_key" };
  const trimmed = key.trim();
  if (!KEY_REGEX.test(trimmed)) return { ok: false, error: "invalid_key" };

  const finalPath = bedrockKeyPath();
  const dir = dirname(finalPath);
  const tmp = join(dir, `.sky-bedrock.json.${process.pid}.tmp`);
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(tmp, JSON.stringify({ key: trimmed }), { mode: 0o600 });
    renameSync(tmp, finalPath);
    chmodSync(finalPath, 0o600);
    return { ok: true };
  } catch {
    try {
      unlinkSync(tmp);
    } catch {
      // best-effort cleanup; nothing of the token is logged either way
    }
    return { ok: false, error: "io_error" };
  }
}

export function clearBedrockKeyFile(): void {
  try {
    if (existsSync(bedrockKeyPath())) unlinkSync(bedrockKeyPath());
  } catch {
    // Idempotent by contract: a missing file is a no-op and a failed unlink does not throw.
  }
}
