import "@tanstack/react-start/server-only";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, renameSync, chmodSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * OpenCode Go key store — write-only, mirrors the `var/sky-openrouter.json` precedent.
 *
 * Resolution order for every reader: box env wins (`SKY_OPENCODE_API_KEY` ?? `OPENCODE_API_KEY`),
 * then the stored file (`var/sky-opencode.json`, mode 0600, gitignored). The file is written only
 * through `saveOpenCodeKey` (admin panel) and never read back to any client surface — every export
 * here is either a boolean/source label or throws nothing; no function returns the key's value to a
 * browser path.
 *
 * Override the file location with `NSAC_OPENCODE_KEY_PATH` (tests, scratch deployments).
 */

// Printable ASCII, no space, 8..512 chars — deliberately provider-agnostic.
const KEY_REGEX = /^[!-~]{8,512}$/;

export function openCodeKeyPath(): string {
  const override = process.env.NSAC_OPENCODE_KEY_PATH?.trim();
  return override && override.length > 0 ? override : join(process.cwd(), "var", "sky-opencode.json");
}

function envKey(): string | null {
  const raw = process.env.SKY_OPENCODE_API_KEY ?? process.env.OPENCODE_API_KEY;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readFileKey(): string | null {
  try {
    const raw = readFileSync(openCodeKeyPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const key = (parsed as { key?: unknown })?.key;
    if (typeof key !== "string") return null;
    const trimmed = key.trim();
    return KEY_REGEX.test(trimmed) ? trimmed : null;
  } catch {
    // Missing file, invalid JSON, wrong shape, bad key — all mean "not configured".
    return null;
  }
}

export function readOpenCodeKey(): string | null {
  return envKey() ?? readFileKey();
}

export function openCodeKeySource(): "env" | "file" | "none" {
  if (envKey() !== null) return "env";
  if (readFileKey() !== null) return "file";
  return "none";
}

export function openCodeKeyFileInfo(): { configured: boolean; updatedAt: number | null } {
  if (readFileKey() === null) return { configured: false, updatedAt: null };
  try {
    return { configured: true, updatedAt: statSync(openCodeKeyPath()).mtimeMs };
  } catch {
    return { configured: false, updatedAt: null };
  }
}

export type SaveOpenCodeKeyResult = { ok: true } | { ok: false; error: "invalid_key" | "io_error" };

export function saveOpenCodeKey(key: unknown): SaveOpenCodeKeyResult {
  if (typeof key !== "string") return { ok: false, error: "invalid_key" };
  const trimmed = key.trim();
  if (!KEY_REGEX.test(trimmed)) return { ok: false, error: "invalid_key" };

  const finalPath = openCodeKeyPath();
  const dir = dirname(finalPath);
  const tmp = join(dir, `.sky-opencode.json.${process.pid}.tmp`);
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
      // best-effort cleanup; nothing of the key is logged either way
    }
    return { ok: false, error: "io_error" };
  }
}

export function clearOpenCodeKeyFile(): void {
  try {
    if (existsSync(openCodeKeyPath())) unlinkSync(openCodeKeyPath());
  } catch {
    // Idempotent by contract: a missing file is a no-op and a failed unlink does not throw.
  }
}
