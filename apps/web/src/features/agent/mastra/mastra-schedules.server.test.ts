import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import {
  astronautIdFromResource,
  buildSchedulesHooks,
  isCardioFinding,
  kindFromMetadata,
  prepareScheduledPrompt,
  scrubScheduledFireError,
  seedDefaultSkySchedules,
} from "./mastra-schedules.server";
import { setClinicalFetch } from "../../clinical/runtime/backend";
import type { ClinicalFinding } from "../../clinical/model/findings";

// Offline tests for the scheduled-fire path (HARNESSING §19). No network, no LLM, no spend:
// the clinical loopback is the injected fetch seam, the trace poster is disabled via
// SKY_TRACE_DISABLED, and the Mastra root used for the seed test runs against a tmp LibSQL file.

const ENV_KEYS = [
  "BACKEND_URL",
  "SKY_TRACE_DISABLED",
  "NSAC_SKY_MASTRA_DB",
  "SKY_SCHEDULES_SEED",
] as const;

function fakeFinding(overrides: Partial<ClinicalFinding> = {}): ClinicalFinding {
  return {
    id: "finding-1",
    astronautId: "ayla-reyes",
    specialistId: "sky-cardio",
    observedAt: "2026-11-16T08:00:00.000Z",
    metricIds: ["heart_rate_bpm"],
    severity: "yellow",
    status: "new",
    summary: "Sustained HR drift above baseline (MAD z=2.8)",
    evidence: { sourceIds: ["telemetry:1..2"], dataKind: "simulated", quality: "valid" },
    requiresMedicalReview: true,
    createdAt: "2026-11-16T08:00:00.000Z",
    updatedAt: "2026-11-16T08:00:00.000Z",
    ...overrides,
  };
}

function findingsFetch(rows: ClinicalFinding[]) {
  return (async () =>
    new Response(JSON.stringify({ ok: true, findings: rows }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

function prepareCtx(schedule: Record<string, unknown>, agentId = "sky-chat") {
  return {
    mastra: {} as never,
    agentId,
    schedule: { id: "agent_test", agentId, ...schedule } as never,
    trigger: { kind: "cron" as const, firedAt: new Date("2026-11-17T00:30:00.000Z") },
  };
}

describe("scheduled-fire helpers", () => {
  it("parses astronaut:<id> resource ids and rejects anything else", () => {
    expect(astronautIdFromResource("astronaut:ayla-reyes")).toBe("ayla-reyes");
    expect(astronautIdFromResource("astronaut:")).toBeNull();
    expect(astronautIdFromResource("global")).toBeNull();
    expect(astronautIdFromResource(42)).toBeNull();
    expect(astronautIdFromResource("astronaut:bad id!")).toBeNull();
  });

  it("reads kind from schedule metadata, bounded to known kinds", () => {
    expect(kindFromMetadata({ kind: "checkin" })).toBe("checkin");
    expect(kindFromMetadata({ kind: "findings-review" })).toBe("findings-review");
    expect(kindFromMetadata({ kind: "cardio-watchdog" })).toBe("cardio-watchdog");
    expect(kindFromMetadata({ kind: "medical-officer" })).toBeNull();
    expect(kindFromMetadata(null)).toBeNull();
    expect(kindFromMetadata("findings-review")).toBeNull();
  });

  it("tags cardio findings the way the backend actually tags them (sky-cardio, heart_rate_bpm)", () => {
    expect(isCardioFinding(fakeFinding())).toBe(true);
    expect(isCardioFinding(fakeFinding({ specialistId: "sky-sleep", metricIds: ["sleep_minutes"] }))).toBe(false);
    expect(
      isCardioFinding(fakeFinding({ specialistId: "sky-other", metricIds: ["spo2_percent"] })),
    ).toBe(false);
    expect(
      isCardioFinding(fakeFinding({ specialistId: "sky-other", metricIds: ["blood_pressure_systolic"] })),
    ).toBe(true);
  });

  it("scrubs error text to a bounded single line", () => {
    expect(scrubScheduledFireError(new Error("boom\nwith\nlines"))).toBe("boom with lines");
    expect(scrubScheduledFireError("x".repeat(500)).length).toBe(200);
    expect(scrubScheduledFireError(undefined)).toBe("error");
  });
});

describe("prepareScheduledPrompt", () => {
  const prev = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) prev.set(key, process.env[key]);
    process.env.SKY_TRACE_DISABLED = "1";
    process.env.BACKEND_URL = "http://127.0.0.1:1";
    setClinicalFetch(null);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = prev.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    prev.clear();
    setClinicalFetch(null);
  });

  it("checkin always fires and prepends the fictional-crew identity line", async () => {
    const prepared = await prepareScheduledPrompt({
      astronautId: "ayla-reyes",
      prompt: "Scheduled check-in. Greet briefly.",
      kind: "checkin",
    });
    expect(prepared).not.toBeNull();
    expect(prepared!.startsWith("Astronaut: Ayla Reyes, Commander (CDR-01). Fictional crew member")).toBe(true);
    expect(prepared).toContain("Scheduled check-in");
  });

  it("is idempotent — an identity-prefixed prompt is kept as-is", async () => {
    const identityFirst = "Astronaut: Ayla Reyes, Commander (CDR-01). Fictional crew member — respond to THEM personally.\ncustom";
    expect(await prepareScheduledPrompt({ astronautId: "ayla-reyes", prompt: identityFirst, kind: "checkin" })).toBe(identityFirst);
  });

  it("findings-review skips silently (zero LLM calls) when nothing is open", async () => {
    setClinicalFetch(findingsFetch([]));
    expect(
      await prepareScheduledPrompt({ astronautId: "ayla-reyes", prompt: "Review.", kind: "findings-review" }),
    ).toBeNull();
  });

  it("findings-review appends bounded findings rows when open findings exist", async () => {
    setClinicalFetch(findingsFetch([fakeFinding({ summary: "x".repeat(400) })]));
    const prepared = await prepareScheduledPrompt({ astronautId: "ayla-reyes", prompt: "Review.", kind: "findings-review" });
    expect(prepared).toContain("VALIDATED FINDINGS (SIMULATED TELEMETRY)");
    expect(prepared).toContain("sky-cardio");
    // summary is capped at 200 chars inside the row
    const json = prepared!.split("\n\n").at(-1)!.split("\n").at(1)!;
    expect(JSON.parse(json)[0].summary.length).toBeLessThanOrEqual(200);
  });

  it("cardio-watchdog ignores green findings and fires on yellow/red cardio findings", async () => {
    setClinicalFetch(findingsFetch([fakeFinding({ severity: "green" })]));
    expect(
      await prepareScheduledPrompt({ astronautId: "ayla-reyes", prompt: "Watch.", kind: "cardio-watchdog" }),
    ).toBeNull();

    setClinicalFetch(findingsFetch([fakeFinding({ specialistId: "sky-sleep", metricIds: ["sleep_minutes"], severity: "red" })]));
    expect(
      await prepareScheduledPrompt({ astronautId: "ayla-reyes", prompt: "Watch.", kind: "cardio-watchdog" }),
    ).toBeNull();

    setClinicalFetch(findingsFetch([fakeFinding({ severity: "red" })]));
    const prepared = await prepareScheduledPrompt({ astronautId: "ayla-reyes", prompt: "Watch.", kind: "cardio-watchdog" });
    expect(prepared).toContain("VALIDATED FINDINGS");
  });

  it("fires anyway with a 'findings unavailable' note when the clinical backend is down", async () => {
    setClinicalFetch((async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch);
    const prepared = await prepareScheduledPrompt({ astronautId: "ayla-reyes", prompt: "Watch.", kind: "findings-review" });
    expect(prepared).toContain("findings unavailable — speak generally");
  });

  it("hooks never throw, even on malformed input", async () => {
    const hooks = buildSchedulesHooks();
    await expect(hooks.onFinish?.(prepareCtx({ resourceId: 42 }) as never)).resolves.toBeUndefined();
    await expect(hooks.onError?.({ ...prepareCtx({}), error: new Error("x"), phase: "prepare" } as never)).resolves.toBeUndefined();
    await expect(hooks.onAbort?.({ ...prepareCtx({}), runId: "run-1" } as never)).resolves.toBeUndefined();
    await expect(hooks.prepare?.(prepareCtx({ resourceId: "astronaut:ayla-reyes", prompt: 42 }) as never)).resolves.toBeUndefined();
    await expect(hooks.prepare?.(prepareCtx({}, "sky-orchestrator") as never)).resolves.toBeUndefined();
  });
});

describe("seedDefaultSkySchedules", () => {
  let dir: string;
  const prev = new Map<string, string | undefined>();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nsac-schedules-seed-"));
    for (const key of ENV_KEYS) prev.set(key, process.env[key]);
    process.env.SKY_SCHEDULES_SEED = "1";
    process.env.SKY_TRACE_DISABLED = "1";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = prev.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    prev.clear();
    rmSync(dir, { recursive: true, force: true });
  });

  function buildRoot(): Mastra {
    return new Mastra({
      storage: new LibSQLStore({ id: "sky-root", url: `file:${join(dir, "sky-mastra.db")}` }),
      scheduler: { enabled: true },
      schedules: buildSchedulesHooks(),
    });
  }

  it("seeds exactly two PAUSED sky-chat schedules, idempotently", async () => {
    const root = buildRoot();
    const seeded = await seedDefaultSkySchedules(root);
    expect(seeded).toBe(2);

    const rows = (await root.schedules.list({ agentId: "sky-chat" })) as Array<{
      status: string;
      threadId?: string;
      resourceId?: string;
      tagName?: string;
      metadata?: Record<string, unknown>;
      cron?: string;
    }>;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status).toBe("paused");
      expect(row.threadId).toBe("astronaut:ayla-reyes");
      expect(row.resourceId).toBe("astronaut:ayla-reyes");
      expect(row.tagName).toBe("sky-schedule");
      expect(row.metadata?.seeded).toBe(true);
    }
    expect(rows.map((r) => r.cron).sort()).toEqual(["0 7 * * *", "0 9,17 * * *"]);

    // Idempotent: a second seed is a no-op and never resurrects rows.
    expect(await seedDefaultSkySchedules(root)).toBe(0);
    expect(await root.schedules.list({ agentId: "sky-chat" })).toHaveLength(2);
  });

  it("honors SKY_SCHEDULES_SEED=0", async () => {
    process.env.SKY_SCHEDULES_SEED = "0";
    const root = buildRoot();
    expect(await seedDefaultSkySchedules(root)).toBe(0);
    expect(await root.schedules.list({ agentId: "sky-chat" })).toHaveLength(0);
  });
});
