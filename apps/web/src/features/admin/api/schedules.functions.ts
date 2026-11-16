import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRequest } from "./admin-gate.server";
import { ensureSkyMastraRoot } from "../../agent/mastra/mastra-observability.server";
import { scrubScheduledFireError } from "../../agent/mastra/mastra-schedules.server";
import { astronautIdentityLine, findAstronaut } from "../../astronaut/model/astronauts";
import {
  defaultPromptFor,
  DEFAULT_NAMES,
  validateScheduleDraft,
} from "../model/schedules-validate";
import type { AnySchedule } from "@mastra/core/schedules";

/**
 * Server functions for the hidden `/admin/schedules` tab — Mastra Schedules threaded into the
 * astronaut chat thread (HARNESSING §19). Same admin gate as every other admin function
 * (HMAC `sky_admin` cookie re-checked here — never trust the client).
 *
 * The agent is FIXED to `sky-chat`: the HUD composer/orchestrator are one-shot profiles, and
 * `sky-medical-officer`'s single-JSON-object output contract is wrong for a chat thread.
 *
 * No response ever carries `providerOptions`, keys or any secret material — rows are mapped to
 * a small explicit shape. `completed` rows are hidden unless `includeCompleted: true` is asked.
 */

export const SKY_CHAT_AGENT_ID = "sky-chat";

export type ScheduleRow = {
  id: string;
  name: string | null;
  cron: string | null;
  runAt: number | null;
  timezone: string | null;
  status: "active" | "paused" | "completed";
  nextFireAt: number | null;
  lastFireAt: number | null;
  kind: string | null;
  astronautId: string | null;
  threadId: string | null;
  tagName: string | null;
  seeded: boolean;
};

function metadataString(metadata: unknown, key: string): string | null {
  if (metadata && typeof metadata === "object") {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim().slice(0, 120);
  }
  return null;
}

function astronautIdFromThread(threadId: unknown, resourceId: unknown): string | null {
  const fromThread =
    typeof threadId === "string" && threadId.startsWith("astronaut:") ? threadId.slice("astronaut:".length) : null;
  if (fromThread) return fromThread.slice(0, 64);
  const fromResource =
    typeof resourceId === "string" && resourceId.startsWith("astronaut:") ? resourceId.slice("astronaut:".length) : null;
  return fromResource ? fromResource.slice(0, 64) : null;
}

function normalizeRow(s: AnySchedule): ScheduleRow {
  const raw = s as unknown as Record<string, unknown>;
  const metadata = raw.metadata;
  const status: ScheduleRow["status"] =
    s.status === "active" || s.status === "paused" || s.status === "completed" ? s.status : "paused";
  return {
    id: s.id,
    name: typeof raw.name === "string" ? raw.name.slice(0, 160) : null,
    cron: typeof raw.cron === "string" ? raw.cron.slice(0, 120) : null,
    runAt: typeof raw.runAt === "number" ? Number(raw.runAt) : null,
    timezone: typeof raw.timezone === "string" ? raw.timezone.slice(0, 64) : null,
    status,
    nextFireAt: typeof raw.nextFireAt === "number" ? raw.nextFireAt : null,
    lastFireAt: typeof raw.lastFireAt === "number" ? raw.lastFireAt : null,
    kind: metadataString(metadata, "kind"),
    astronautId: metadataString(metadata, "astronautId") ?? astronautIdFromThread(raw.threadId, raw.resourceId),
    threadId: typeof raw.threadId === "string" ? raw.threadId.slice(0, 80) : null,
    tagName: typeof raw.tagName === "string" ? raw.tagName.slice(0, 80) : null,
    seeded:
      metadata !== null && typeof metadata === "object"
        ? (metadata as Record<string, unknown>).seeded === true
        : false,
  };
}

export type ListSchedulesResult =
  | { status: "unauthorized" }
  | { status: "unavailable" }
  | { status: "ok"; schedules: ScheduleRow[] };

export const listSchedulesFn = createServerFn({ method: "POST" })
  .validator(z.object({ includeCompleted: z.boolean().optional() }).optional())
  .handler(async ({ data }): Promise<ListSchedulesResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    try {
      const root = await ensureSkyMastraRoot();
      if (!root) return { status: "unavailable" };
      const rows = await root.schedules.list({ agentId: SKY_CHAT_AGENT_ID });
      const includeCompleted = data?.includeCompleted === true;
      const schedules = rows
        .map(normalizeRow)
        .filter((row) => includeCompleted || row.status !== "completed")
        .sort((a, b) => (a.nextFireAt ?? Number.MAX_SAFE_INTEGER) - (b.nextFireAt ?? Number.MAX_SAFE_INTEGER));
      return { status: "ok", schedules };
    } catch (error) {
      console.warn("[sky-schedules] list failed:", scrubScheduledFireError(error));
      return { status: "unavailable" };
    }
  });

export type CreateScheduledCheckInResult =
  | { status: "unauthorized" }
  | { status: "unavailable" }
  | { status: "invalid_astronaut" | "invalid_kind" | "invalid_cron" | "invalid_timezone" | "invalid_prompt" | "invalid_name" | "invalid" }
  | { status: "error"; message: string }
  | { status: "ok"; id: string };

export const createScheduledCheckInFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      astronautId: z.string().max(80),
      kind: z.string().max(40),
      cron: z.string().max(200),
      timezone: z.string().max(80).optional(),
      prompt: z.string().max(1001).optional(),
      name: z.string().max(121).optional(),
    }),
  )
  .handler(async ({ data }): Promise<CreateScheduledCheckInResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    const draft = validateScheduleDraft(data);
    if (!draft.ok) {
      const map = {
        unknown_astronaut: "invalid_astronaut",
        bad_kind: "invalid_kind",
        bad_cron: "invalid_cron",
        bad_timezone: "invalid_timezone",
        bad_prompt: "invalid_prompt",
        bad_name: "invalid_name",
      } as const;
      return { status: map[draft.error] };
    }
    const { astronautId, kind, cron, timezone, prompt, name } = draft.value;
    const astronaut = findAstronaut(astronautId);
    if (!astronaut) return { status: "invalid_astronaut" };

    const identity = astronautIdentityLine(astronaut);
    const body = prompt ?? defaultPromptFor(kind);
    const finalPrompt = `${identity}\n${body}`;
    const finalName = name ?? `${DEFAULT_NAMES[kind]} — ${astronaut.name.split(/\s+/)[0]}`;
    const threadId = `astronaut:${astronautId}`;

    try {
      const root = await ensureSkyMastraRoot();
      if (!root) return { status: "unavailable" };

      // Best effort: make sure the astronaut's Mastra thread exists, otherwise the first fire
      // ends in `thread-missing` and Mastra's self-clean DELETES the schedule row.
      try {
        const agent = (root as unknown as { getAgent?: (id: string) => { getMemory?: () => Promise<{ getThreadById?: (a: { threadId: string }) => Promise<unknown>; createThread?: (a: { threadId: string; resourceId: string }) => Promise<unknown> } | null> } })
          .getAgent?.(SKY_CHAT_AGENT_ID);
        const memory = agent?.getMemory ? await agent.getMemory() : null;
        if (memory?.getThreadById && memory.createThread) {
          const existing = await memory.getThreadById({ threadId });
          if (!existing) await memory.createThread({ threadId, resourceId: threadId });
        }
      } catch (error) {
        console.warn("[sky-schedules] thread ensure failed:", scrubScheduledFireError(error));
      }

      const created = await root.schedules.create({
        agentId: SKY_CHAT_AGENT_ID,
        cron,
        timezone,
        prompt: finalPrompt,
        name: finalName.slice(0, 160),
        threadId,
        resourceId: threadId,
        tagName: "sky-schedule",
        ifActive: { behavior: "discard" },
        ifIdle: { behavior: "wake" },
        metadata: { kind, astronautId, seeded: false },
      });
      return { status: "ok", id: created.id };
    } catch (error) {
      const message = scrubScheduledFireError(error);
      // Mastra/croner validation failures carry "Invalid" — surface them as `invalid`.
      if (/invalid/i.test(message)) return { status: "invalid" };
      console.warn("[sky-schedules] create failed:", message);
      return { status: "error", message };
    }
  });

const idSchema = z.object({ id: z.string().trim().min(1).max(80) });

export type ScheduleActionResult =
  | { status: "unauthorized" }
  | { status: "unavailable" }
  | { status: "error"; message: string }
  | { status: "ok" };

async function withRoot(
  run: (root: NonNullable<Awaited<ReturnType<typeof ensureSkyMastraRoot>>>) => Promise<unknown>,
): Promise<ScheduleActionResult> {
  try {
    const root = await ensureSkyMastraRoot();
    if (!root) return { status: "unavailable" };
    await run(root);
    return { status: "ok" };
  } catch (error) {
    const message = scrubScheduledFireError(error);
    console.warn("[sky-schedules] action failed:", message);
    return { status: "error", message };
  }
}

export const pauseScheduleFn = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<ScheduleActionResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    return withRoot((root) => root.schedules.pause(data.id));
  });

export const resumeScheduleFn = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<ScheduleActionResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    return withRoot((root) => root.schedules.resume(data.id));
  });

export const runScheduleFn = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<ScheduleActionResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    // Fire-now is a claim + enqueue; the turn itself is NOT awaited here.
    return withRoot((root) => root.schedules.run(data.id));
  });

export const deleteScheduleFn = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<ScheduleActionResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    return withRoot((root) => root.schedules.delete(data.id));
  });


