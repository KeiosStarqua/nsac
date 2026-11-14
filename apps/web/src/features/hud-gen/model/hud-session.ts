// Pure path helpers for the per-astronaut composer session files. The composer stores one session per
// crew member next to the chat transcripts: `var/sky-sessions/<id>.hud.jsonl`. Kept pure so tests can
// pin the exact filename without touching the filesystem.
import { sanitizeAstronautId } from "~/features/agent/model/chat";

/** Suffix PI SDK session managers see in the file stem; the transcript file ends up `<id>.hud.jsonl`. */
export const HUD_SESSION_SUFFIX = ".hud";

/** `<id>.hud` — the session-manager id. Null for ids that are not [a-z0-9-] (and > 64 chars after trim). */
export function hudSessionId(astronautId: string): string | null {
  const id = sanitizeAstronautId(astronautId);
  return id ? `${id}${HUD_SESSION_SUFFIX}` : null;
}

/** `<id>.hud.jsonl` — the file the session writes under the sessions directory. */
export function hudSessionFileName(astronautId: string): string | null {
  const sid = hudSessionId(astronautId);
  return sid ? `${sid}.jsonl` : null;
}
