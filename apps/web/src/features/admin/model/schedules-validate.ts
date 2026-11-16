// Pure validation for the /admin/schedules create form — no IO, unit-testable.
// Mastra (croner) is the FINAL validator at create time; everything rejected here never leaves.
import { ASTRONAUTS } from "../../astronaut/model/astronauts";

export const SCHEDULE_KINDS = ["checkin", "cardio-watchdog", "findings-review"] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

export const DEFAULT_PROMPTS: Record<ScheduleKind, string> = {
  checkin:
    "Scheduled check-in. Greet the astronaut briefly in their language, one warm question about sleep and readiness; never diagnose; no actions without confirmation.",
  "cardio-watchdog":
    "Scheduled cardio watch. If validated cardio findings are open, summarize them in one short line; never diagnose; ask before anything; no actions without confirmation.",
  "findings-review":
    "Scheduled review. Summarize anything open since yesterday in one short line; never diagnose; ask before anything; no actions without confirmation.",
};

export function defaultPromptFor(kind: ScheduleKind): string {
  return DEFAULT_PROMPTS[kind];
}

export const DEFAULT_NAMES: Record<ScheduleKind, string> = {
  checkin: "Morning check-in",
  "cardio-watchdog": "Cardio watchdog",
  "findings-review": "Findings review",
};

export const PROMPT_MAX_CHARS = 1000;
export const NAME_MAX_CHARS = 120;
const TIMEZONE_MAX = 64;

const CRON_PART = String.raw`[\dA-Za-z*/?,\-#LW]+`;
const CRON_NICKNAME = /^@(hourly|daily|weekly|monthly|midnight)$/;
const CRON_PARTS = new RegExp(`^(${CRON_PART})(\\s+${CRON_PART}){4,6}$`);

/** Cron accepted by the form: 5/6/7 space-separated parts or a croner nickname. Final validation = Mastra. */
export function isCronLike(value: string): boolean {
  const trimmed = value.trim();
  if (CRON_NICKNAME.test(trimmed)) return true;
  if (!CRON_PARTS.test(trimmed)) return false;
  const parts = trimmed.split(/\s+/);
  return parts.length >= 5 && parts.length <= 7;
}

/** IANA-ish timezone check — Intl throws RangeError for unknown zones. */
export function isIanaTimeZone(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > TIMEZONE_MAX) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

export type ScheduleDraft = {
  astronautId: string;
  kind: ScheduleKind;
  cron: string;
  timezone: string;
  prompt: string | null;
  name: string | null;
};

export type ScheduleDraftError =
  | "unknown_astronaut"
  | "bad_kind"
  | "bad_cron"
  | "bad_timezone"
  | "bad_prompt"
  | "bad_name";

export type ScheduleDraftResult =
  | { readonly ok: true; readonly value: ScheduleDraft }
  | { readonly ok: false; readonly error: ScheduleDraftError };

export function validateScheduleDraft(input: {
  astronautId?: unknown;
  kind?: unknown;
  cron?: unknown;
  timezone?: unknown;
  prompt?: unknown;
  name?: unknown;
}): ScheduleDraftResult {
  const astronautId = typeof input.astronautId === "string" ? input.astronautId.trim() : "";
  if (!ASTRONAUTS.some((a) => a.id === astronautId)) return { ok: false, error: "unknown_astronaut" };

  const kind = typeof input.kind === "string" ? input.kind.trim() : "";
  if (!(SCHEDULE_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "bad_kind" };

  const cron = typeof input.cron === "string" ? input.cron.trim() : "";
  if (!isCronLike(cron)) return { ok: false, error: "bad_cron" };

  const timezoneRaw = typeof input.timezone === "string" ? input.timezone.trim() : "";
  const timezone = timezoneRaw.length > 0 ? timezoneRaw : "Asia/Ho_Chi_Minh";
  if (!isIanaTimeZone(timezone)) return { ok: false, error: "bad_timezone" };

  let prompt: string | null = null;
  if (typeof input.prompt === "string") {
    const trimmed = input.prompt.trim();
    if (trimmed.length > PROMPT_MAX_CHARS) return { ok: false, error: "bad_prompt" };
    if (trimmed.length > 0) prompt = trimmed;
  } else if (input.prompt !== undefined && input.prompt !== null) {
    return { ok: false, error: "bad_prompt" };
  }

  let name: string | null = null;
  if (typeof input.name === "string") {
    const trimmed = input.name.trim();
    if (trimmed.length > NAME_MAX_CHARS) return { ok: false, error: "bad_name" };
    if (trimmed.length > 0) name = trimmed;
  } else if (input.name !== undefined && input.name !== null) {
    return { ok: false, error: "bad_name" };
  }

  return { ok: true, value: { astronautId, kind: kind as ScheduleKind, cron, timezone, prompt, name } };
}
