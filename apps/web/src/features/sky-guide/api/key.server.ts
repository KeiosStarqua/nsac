// Server-only: imported only from *.functions.ts handlers and compose.server.ts. The marker import makes
// the build fail loudly if this file ever ends up in the client bundle.
import "@tanstack/react-start/server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseOpenRouterKey } from "../model/api-key";

/**
 * The one secret Sky's composer keeps: an OpenRouter key. Two sources, in order:
 * the `SKY_OPENROUTER_API_KEY` environment variable (preferred for the deployed demo — set it via the
 * service environment, never in the repo or the flake), then `var/sky-openrouter.json` under the process
 * working directory (gitignored, mode 0600; set `NSAC_SETTINGS_PATH` to point elsewhere). The file is
 * mode 0600, the key is write-only: no read path leaves this module. A malformed env key falls back to
 * the file; a set-but-empty one counts as absent.
 */
const SETTINGS_PATH = process.env.NSAC_SETTINGS_PATH ?? resolve(process.cwd(), "var", "sky-openrouter.json");

interface SettingsFile {
  openrouterKey?: unknown;
}

/** The key from the environment, or `null` when it is unset/blank/malformed. */
function readEnvKey(): string | null {
  const raw = process.env.SKY_OPENROUTER_API_KEY;
  if (typeof raw !== "string") return null;
  return parseOpenRouterKey(raw);
}

/** The env key when set, else the file key, or `null` (the demo must not crash when neither is readable). */
export function readOpenRouterKey(): string | null {
  const fromEnv = readEnvKey();
  if (fromEnv !== null) return fromEnv;
  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_PATH, "utf8")) as SettingsFile;
    return typeof parsed.openrouterKey === "string" ? parseOpenRouterKey(parsed.openrouterKey) : null;
  } catch {
    return null;
  }
}

export type SaveOpenRouterKeyResult = { ok: true } | { ok: false; problem: "invalid" | "io" };

export function saveOpenRouterKey(raw: string): SaveOpenRouterKeyResult {
  const key = parseOpenRouterKey(raw);
  if (key === null) return { ok: false, problem: "invalid" };
  try {
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true, mode: 0o700 });
    const tmp = `${SETTINGS_PATH}.tmp`;
    writeFileSync(tmp, JSON.stringify({ openrouterKey: key }), { mode: 0o600 });
    renameSync(tmp, SETTINGS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, problem: "io" };
  }
}
