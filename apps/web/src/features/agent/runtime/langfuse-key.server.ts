import "@tanstack/react-start/server-only";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, renameSync, chmodSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Langfuse tracing store — write-only, mirrors the `var/sky-bedrock.json` precedent but keeps all
 * three Langfuse variables in ONE atomic record, because tracing needs the triple together.
 *
 * Resolution order for every reader, never mixed per variable: the box env wins when
 * `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` + `LANGFUSE_BASE_URL` are ALL non-empty (trimmed),
 * else the stored file (`var/sky-langfuse.json`, mode 0600, gitignored) when all three entries are
 * valid, else `null` — tracing off. `LANGFUSE_ENVIRONMENT` / `LANGFUSE_RELEASE` stay env-only
 * optional tags and never gate anything.
 *
 * The file is written only through `saveLangfuseConfig` (admin panel) and never read back to any
 * client surface — `langfuseFileInfo` exposes presence, timestamp and the base URL (an address, not
 * a credential) and nothing else. No function here returns a key to a browser path.
 *
 * Override the file location with `NSAC_LANGFUSE_KEY_PATH` (tests, scratch deployments).
 */

// Langfuse key shape, tolerant of self-host variants: pk-/sk- prefix then URL-safe characters.
const PUBLIC_KEY_REGEX = /^pk-[A-Za-z0-9_-]{4,228}$/;
const SECRET_KEY_REGEX = /^sk-[A-Za-z0-9_-]{4,228}$/;

// `http://` is a local-dev convenience only; every real instance must be https.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type LangfuseConfigInput = { publicKey: string; secretKey: string; baseUrl: string };

export type LangfuseConfig = LangfuseConfigInput & { environment?: string; release?: string };

export type LangfuseValidation =
  | { ok: true; value: LangfuseConfigInput }
  | { ok: false; error: "invalid_public_key" | "invalid_secret_key" | "invalid_base_url" };

export function langfuseKeyPath(): string {
  const override = process.env.NSAC_LANGFUSE_KEY_PATH?.trim();
  return override && override.length > 0 ? override : join(process.cwd(), "var", "sky-langfuse.json");
}

function trimmedEnv(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Trimmed base URL, or `null` when it is not an acceptable tracing endpoint. */
function normalizeBaseUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  // Credentials in the URL would end up in logs and trace payloads; never accept them.
  if (url.username !== "" || url.password !== "") return null;
  if (url.protocol === "https:") return trimmed;
  if (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) return trimmed;
  return null;
}

/** Validate one full Langfuse triple. Shared by the store, the admin server function and file reads. */
export function validateLangfuseConfig(input: unknown): LangfuseValidation {
  const candidate = (input ?? {}) as { publicKey?: unknown; secretKey?: unknown; baseUrl?: unknown };
  const publicKey = typeof candidate.publicKey === "string" ? candidate.publicKey.trim() : null;
  if (publicKey === null || !PUBLIC_KEY_REGEX.test(publicKey)) return { ok: false, error: "invalid_public_key" };
  const secretKey = typeof candidate.secretKey === "string" ? candidate.secretKey.trim() : null;
  if (secretKey === null || !SECRET_KEY_REGEX.test(secretKey)) return { ok: false, error: "invalid_secret_key" };
  const baseUrl = normalizeBaseUrl(candidate.baseUrl);
  if (baseUrl === null) return { ok: false, error: "invalid_base_url" };
  return { ok: true, value: { publicKey, secretKey, baseUrl } };
}

/** All three env variables at once, or `null`. Presence-only: env wins without being re-validated. */
function envConfig(): LangfuseConfigInput | null {
  const publicKey = trimmedEnv("LANGFUSE_PUBLIC_KEY");
  const secretKey = trimmedEnv("LANGFUSE_SECRET_KEY");
  const baseUrl = trimmedEnv("LANGFUSE_BASE_URL");
  if (!publicKey || !secretKey || !baseUrl) return null;
  return { publicKey, secretKey, baseUrl };
}

/** The stored file at once, or `null` when missing/corrupt/invalid. */
function readFileConfig(): LangfuseConfigInput | null {
  try {
    const raw = readFileSync(langfuseKeyPath(), "utf8");
    const parsed = JSON.parse(raw) as { publicKey?: unknown; secretKey?: unknown; baseUrl?: unknown };
    const result = validateLangfuseConfig({
      publicKey: parsed?.publicKey,
      secretKey: parsed?.secretKey,
      baseUrl: parsed?.baseUrl,
    });
    return result.ok ? result.value : null;
  } catch {
    // Missing file, invalid JSON, wrong shape, bad values — all mean "not configured".
    return null;
  }
}

/**
 * Resolve the tracing configuration, or `null` when tracing is off. Env wins as a whole triple;
 * the file is the fallback as a whole triple. The optional tags are env-only on either source.
 */
export function readLangfuseConfig(): LangfuseConfig | null {
  const base = envConfig() ?? readFileConfig();
  if (!base) return null;
  const environment = trimmedEnv("LANGFUSE_ENVIRONMENT");
  const release = trimmedEnv("LANGFUSE_RELEASE");
  return {
    ...base,
    ...(environment ? { environment } : {}),
    ...(release ? { release } : {}),
  };
}

export function langfuseKeySource(): "env" | "file" | "none" {
  if (envConfig() !== null) return "env";
  if (readFileConfig() !== null) return "file";
  return "none";
}

export function langfuseFileInfo(): { configured: boolean; updatedAt: number | null; baseUrl: string | null } {
  const file = readFileConfig();
  if (file === null) return { configured: false, updatedAt: null, baseUrl: null };
  try {
    return { configured: true, updatedAt: statSync(langfuseKeyPath()).mtimeMs, baseUrl: file.baseUrl };
  } catch {
    return { configured: false, updatedAt: null, baseUrl: null };
  }
}

export type SaveLangfuseConfigResult = { ok: true } | { ok: false; error: "invalid" | "io_error" };

export function saveLangfuseConfig(input: unknown): SaveLangfuseConfigResult {
  const validated = validateLangfuseConfig(input);
  if (!validated.ok) return { ok: false, error: "invalid" };

  const finalPath = langfuseKeyPath();
  const dir = dirname(finalPath);
  const tmp = join(dir, `.sky-langfuse.json.${process.pid}.tmp`);
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(tmp, JSON.stringify({ ...validated.value, savedAt: Date.now() }), { mode: 0o600 });
    renameSync(tmp, finalPath);
    chmodSync(finalPath, 0o600);
    return { ok: true };
  } catch {
    try {
      unlinkSync(tmp);
    } catch {
      // best-effort cleanup; nothing of the keys is logged either way
    }
    return { ok: false, error: "io_error" };
  }
}

export function clearLangfuseKeyFile(): void {
  try {
    if (existsSync(langfuseKeyPath())) unlinkSync(langfuseKeyPath());
  } catch {
    // Idempotent by contract: a missing file is a no-op and a failed unlink does not throw.
  }
}
