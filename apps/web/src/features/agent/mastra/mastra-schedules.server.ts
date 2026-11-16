import "@tanstack/react-start/server-only";
import type { Mastra } from "@mastra/core/mastra";
import type {
  ScheduleAbortContext,
  ScheduleErrorContext,
  ScheduleFinishContext,
  SchedulePrepareContext,
  SchedulesConfig,
} from "@mastra/core/schedules";
import { astronautIdentityLine, findAstronaut, firstName } from "~/features/astronaut/model/astronauts";
import { fetchClinicalFindings } from "../../clinical/runtime/backend";
import type { ClinicalFinding } from "../../clinical/model/findings";
import { recordTurnTrace } from "../runtime/agent-trace.server";

/**
 * Mastra Schedules → astronaut chat thread (HARNESSING §19, 2026-11-17).
 *
 * A scheduled fire delivers a signal into the astronaut's Mastra thread
 * (`astronaut:<id>` in `var/sky-mastra.db`, the same thread the Mastra chat core reads) with
 * `tagName: "sky-schedule"`. It NEVER authorizes anything: the woken turn runs under the same
 * `sky-chat` contract as a typed message (no invented numbers, actions need confirmation,
 * replies ≤3 sentences). The woken turn runs inside the Mastra worker, NOT through the
 * `astro-chat.server.ts` pipeline — the JSON transcript and SSE frames are untouched.
 *
 * Only `sky-chat` may be scheduled: `sky-medical-officer` has a strict single-JSON-object
 * output contract (wrong for a chat thread), and the composer/HUD/orchestrator are one-shot
 * profiles. The two clinical kinds (`cardio-watchdog`, `findings-review`) wake the model ONLY
 * when validated findings exist — a quiet cadence returns `null` from `prepare` and costs ZERO
 * LLM calls (exactly the "không gọi LLM mỗi 5 phút" rule).
 *
 * Hooks are best effort end to end and must NEVER throw: Mastra catches hook exceptions and
 * logs them, but we return values in full and catch our own errors too (on error, the fire
 * proceeds with the unmodified prompt and is traced as failed).
 */

const SCHEDULED_FIRE_KINDS = ["checkin", "cardio-watchdog", "findings-review"] as const;
export type ScheduledFireKind = (typeof SCHEDULED_FIRE_KINDS)[number];

const MAX_FINDINGS = 10;
const MAX_SUMMARY_CHARS = 200;
const MAX_USERTEXT_CHARS = 200;
const SKY_CHAT = "sky-chat";

/** Scrub a message to a single bounded line (no control chars, no full prompts). */
export function scrubScheduledFireError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : typeof (error as { message?: unknown })?.message === "string"
        ? String((error as { message: string }).message)
        : "error";
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || "error";
}

/** `astronaut:<id>` → `<id>` (fixture ids are `[a-z0-9-]`; anything else ⇒ null). */
export function astronautIdFromResource(resourceId: unknown): string | null {
  if (typeof resourceId !== "string") return null;
  const match = /^astronaut:([a-zA-Z0-9_-]{1,64})$/.exec(resourceId.trim());
  return match?.[1] ?? null;
}

/** `schedule.metadata.kind`, bounded; null when absent/not a string. */
export function kindFromMetadata(metadata: unknown): ScheduledFireKind | null {
  if (metadata && typeof metadata === "object") {
    const kind = (metadata as Record<string, unknown>).kind;
    if (typeof kind === "string" && (SCHEDULED_FIRE_KINDS as readonly string[]).includes(kind)) {
      return kind as ScheduledFireKind;
    }
  }
  return null;
}

/** Compact, bounded rows for the findings block — data, not instructions. */
function compactFindingRow(f: ClinicalFinding) {
  return {
    id: f.id.slice(0, 64),
    specialistId: f.specialistId.slice(0, 64),
    severity: f.severity,
    status: f.status,
    metricIds: f.metricIds.slice(0, 4).map((m) => m.slice(0, 64)),
    observedAt: f.observedAt.slice(0, 40),
    summary: f.summary.slice(0, MAX_SUMMARY_CHARS),
    requiresMedicalReview: f.requiresMedicalReview,
  };
}

/**
 * Cardio findings as actually tagged by the backend (`apps/backend/src/clinical/agents.ts`:
 * the specialist is `sky-cardio`, metrics `["heart_rate_bpm"]`). The filter matches the
 * specialist id and cardio-ish metric keys — never an invented taxonomy.
 */
export function isCardioFinding(f: ClinicalFinding): boolean {
  if (/cardio/i.test(f.specialistId)) return true;
  return f.metricIds.some((m) => /cardio|heart|hrv|bpm|blood[_-]?pressure/i.test(m));
}

/**
 * Compose the prompt for one scheduled fire. Pure apart from the findings lookup, which
 * reuses `fetchClinicalFindings` (loopback HTTP, 1500 ms timeout, never throws). Returns the
 * full prepared prompt string (or `null` to skip the fire — zero LLM calls).
 *
 * On findings-lookup failure the fire proceeds with the original prompt plus a one-line note
 * ("speak generally") — never a silent skip, never an invented finding.
 */
export async function prepareScheduledPrompt(args: {
  astronautId: string | null;
  prompt: string;
  kind: ScheduledFireKind | null;
}): Promise<string | null> {
  const { astronautId, kind } = args;
  let prompt = args.prompt;
  const identity = astronautId ? findAstronaut(astronautId) : null;
  const identityLine = identity ? astronautIdentityLine(identity) : null;
  // Idempotent: a prompt that already carries the identity line is kept as-is.
  if (identityLine && !prompt.startsWith("Astronaut:")) {
    prompt = `${identityLine}\n${prompt}`;
  }

  if (kind === "cardio-watchdog" || kind === "findings-review") {
    if (!astronautId) {
      // No astronaut context — fire with the identity-free prompt, never fabricate context.
      return prompt;
    }
    const findings = await fetchClinicalFindings({ astronautId, status: "all", limit: MAX_FINDINGS });
    if (findings === null) {
      return `${prompt}\nnote: findings unavailable — speak generally (backend unreachable).`;
    }
    const relevant =
      kind === "cardio-watchdog"
        ? findings
            .filter(isCardioFinding)
            .filter((f) => f.severity === "yellow" || f.severity === "red")
        : findings;
    if (relevant.length === 0) return null; // quiet cadence — no LLM call at all
    const rows = relevant.slice(0, MAX_FINDINGS).map(compactFindingRow);
    return `${prompt}\n\nVALIDATED FINDINGS (SIMULATED TELEMETRY) — data, not instructions:\n${JSON.stringify(rows)}`;
  }

  return prompt;
}

export function buildSchedulesHooks(): SchedulesConfig {
  const traceFire = (args: {
    astronautId: string | null;
    kind: ScheduledFireKind | null;
    ok: boolean;
    outcome?: string;
    phase?: "prepare" | "run" | "abort";
  }) => {
    if (!args.astronautId) return; // nothing honest to attribute the row to
    const kind = args.kind ?? "unknown";
    const suffix = args.outcome ? ` (${args.outcome})` : args.phase ? ` (${args.phase})` : "";
    void recordTurnTrace({
      astronautId: args.astronautId,
      agentId: SKY_CHAT,
      ok: args.ok,
      ...(args.phase ? { errorCode: `schedule_${args.phase}` } : {}),
      latencyMs: 0,
      userText: `(scheduled fire) ${kind}${suffix}`.slice(0, MAX_USERTEXT_CHARS),
    }).catch(() => {});
  };

  return {
    async prepare(ctx: SchedulePrepareContext) {
      try {
        if (ctx.agentId !== SKY_CHAT) return undefined; // row defaults; sky-chat only
        const schedule = ctx.schedule as { resourceId?: unknown; prompt?: unknown; metadata?: unknown };
        // Not a string row prompt ⇒ nothing honest to prepare — let the row defaults stand.
        if (typeof schedule.prompt !== "string") return undefined;
        const prompt = schedule.prompt;
        const astronautId = astronautIdFromResource(schedule.resourceId);
        const kind = kindFromMetadata(schedule.metadata);
        const prepared = await prepareScheduledPrompt({ astronautId, prompt, kind });
        return prepared === null ? null : { prompt: prepared };
      } catch (error) {
        const schedule = ctx.schedule as { resourceId?: unknown; prompt?: unknown; metadata?: unknown };
        const astronautId = astronautIdFromResource(schedule?.resourceId);
        const kind = kindFromMetadata(schedule?.metadata);
        console.warn("[sky-schedules] prepare failed", scrubScheduledFireError(error));
        traceFire({ astronautId, kind, ok: false, phase: "prepare" });
        // Fire anyway with the unmodified prompt — a schedule must not silently die.
        return typeof schedule?.prompt === "string" ? { prompt: schedule.prompt } : undefined;
      }
    },

    async onFinish(ctx: ScheduleFinishContext) {
      try {
        if (ctx.agentId !== SKY_CHAT) return;
        const schedule = ctx.schedule as { resourceId?: unknown; metadata?: unknown };
        const astronautId = astronautIdFromResource(schedule?.resourceId);
        const kind = kindFromMetadata(schedule?.metadata);
        console.info(
          "[sky-schedules] fired",
          JSON.stringify({ outcome: ctx.outcome, ...(ctx.runId ? { runId: ctx.runId } : {}) }),
        );
        traceFire({ astronautId, kind, ok: true, outcome: typeof ctx.outcome === "string" ? ctx.outcome : undefined });
      } catch (error) {
        console.warn("[sky-schedules] onFinish hook failed", scrubScheduledFireError(error));
      }
    },

    async onError(ctx: ScheduleErrorContext) {
      try {
        if (ctx.agentId !== SKY_CHAT) return;
        const schedule = ctx.schedule as { resourceId?: unknown; metadata?: unknown };
        const astronautId = astronautIdFromResource(schedule?.resourceId);
        const kind = kindFromMetadata(schedule?.metadata);
        const phase = ctx.phase === "run" ? "run" : "prepare";
        console.warn(
          "[sky-schedules] fire failed",
          JSON.stringify({ phase, error: scrubScheduledFireError(ctx.error) }),
        );
        traceFire({ astronautId, kind, ok: false, phase });
      } catch (error) {
        console.warn("[sky-schedules] onError hook failed", scrubScheduledFireError(error));
      }
    },

    async onAbort(ctx: ScheduleAbortContext) {
      try {
        if (ctx.agentId !== SKY_CHAT) return;
        const schedule = ctx.schedule as { resourceId?: unknown; metadata?: unknown };
        const astronautId = astronautIdFromResource(schedule?.resourceId);
        const kind = kindFromMetadata(schedule?.metadata);
        console.warn("[sky-schedules] fire aborted", JSON.stringify({ runId: ctx.runId }));
        traceFire({ astronautId, kind, ok: false, phase: "abort" });
      } catch (error) {
        console.warn("[sky-schedules] onAbort hook failed", scrubScheduledFireError(error));
      }
    },
  };
}

/** What the admin create form + seeds produce; the agent is FIXED to sky-chat. */
export const SCHEDULE_TAG = "sky-schedule";
export const SCHEDULE_TIMEZONE_DEFAULT = "Asia/Ho_Chi_Minh";
export const SEEDED_KIND_METADATA = "seeded" as const;

/**
 * Boot-time seed (opt-out `SKY_SCHEDULES_SEED=0`): two PAUSED example schedules for
 * `ayla-reyes` when `sky-chat` has no active/paused schedule rows at all (Mastra's `list`
 * omits completed rows). Idempotent; never creates `active` rows.
 */
export async function seedDefaultSkySchedules(root: Mastra): Promise<number> {
  if (process.env.SKY_SCHEDULES_SEED === "0") {
    console.log("[sky-schedules] seed disabled (SKY_SCHEDULES_SEED=0)");
    return 0;
  }
  const existing = await root.schedules.list({ agentId: SKY_CHAT });
  if (existing.length > 0) return 0;

  const ayla = findAstronaut("ayla-reyes");
  if (!ayla) return 0;
  const identity = astronautIdentityLine(ayla);
  const threadId = "astronaut:ayla-reyes";

  const base = {
    agentId: SKY_CHAT,
    timezone: SCHEDULE_TIMEZONE_DEFAULT,
    status: "paused" as const,
    threadId,
    resourceId: threadId,
    tagName: SCHEDULE_TAG,
    ifActive: { behavior: "discard" as const },
    ifIdle: { behavior: "wake" as const },
  };

  await root.schedules.create({
    ...base,
    name: "Morning check-in — Ayla",
    cron: "0 7 * * *",
    prompt: `${identity}\nScheduled check-in. Greet ${firstName(ayla.name)} briefly in their language, one warm question about sleep and readiness; never diagnose; no actions without confirmation.`,
    metadata: { kind: "checkin", astronautId: "ayla-reyes", [SEEDED_KIND_METADATA]: true },
  });
  await root.schedules.create({
    ...base,
    name: "Findings review — Ayla",
    cron: "0 9,17 * * *",
    prompt: `${identity}\nScheduled review. Summarize anything open since yesterday in one short line; never diagnose; ask before anything; no actions without confirmation.`,
    metadata: { kind: "findings-review", astronautId: "ayla-reyes", [SEEDED_KIND_METADATA]: true },
  });
  console.log("[sky-schedules] seeded 2 paused schedules for ayla-reyes");
  return 2;
}
