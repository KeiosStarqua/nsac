// Server-only: imported only from *.functions.ts handlers and compose.server.ts. The marker import makes
// the build fail loudly if this file ever ends up in the client bundle.
import "@tanstack/react-start/server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseOpenRouterKey } from "../model/api-key";

/**
 * The one secret Sky's composer keeps: an OpenRouter key, saved on the demo laptop — never in the repo.
 * Default location is `var/sky-openrouter.json` under the process working directory (gitignored); set
 * `NSAC_SETTINGS_PATH` to point elsewhere. The file is mode 0600, the key is write-only: no read path
 * leaves this module.
 */
const SETTINGS_PATH = process.env.NSAC_SETTINGS_PATH ?? resolve(process.cwd(), "var", "sky-openrouter.json");

interface SettingsFile {
  openrouterKey?: unknown;
}

/** The saved key, or `null` when there is none (or the file is unreadable — the demo must not crash on it). */
export function readOpenRouterKey(): string | null {
  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_PATH, "utf8")) as SettingsFile;
    return typeof parsed.openrouterKey === "string" && parsed.openrouterKey.length > 0 ? parsed.openrouterKey : null;
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
