import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "sky-clinical-scheduler-"));
process.env.SKY_DB_PATH = join(dir, "scheduler.db");

type SchedulerModule = typeof import("../src/clinical/scheduler");
type FindingsModule = typeof import("../src/clinical/findings");
type AgentsModule = typeof import("../src/clinical/agents");
type TelemetryRepoModule = typeof import("../src/db/repositories/telemetry");

let scheduler: SchedulerModule;
let findings: FindingsModule["findingsService"];
let cardioAgent: AgentsModule["cardioAgent"];
let telemetryRepo: TelemetryRepoModule["telemetryRepo"];
let clinicalDb: typeof import("../src/db/clinicalClient")["clinicalDb"];
let schema: typeof import("../src/db/schema/clinical");
let eq: typeof import("drizzle-orm")["eq"];
let and: typeof import("drizzle-orm")["and"];

const cyclicBaseline = (n: number) => Array.from({ length: n }, (_, i) => [64, 68, 72][i % 3]);

function seedTelemetry(astronautId: string, values: number[], newestAgeMinutes = 1) {
  const now = Date.now() - newestAgeMinutes * 60_000;
  const n = values.length;
  telemetryRepo.insertBatch(
    values.map((v, i) => ({
      eventId: `sched-${astronautId}-${crypto.randomUUID().slice(0, 8)}`,
      missionId: "test-mission",
      crewId: astronautId,
      deviceId: "test-watch-1",
      deviceType: "watch",
      locationId: null,
      sourceMode: "synthetic" as const,
      datasetId: null,
      observedAt: new Date(now - (n - 1 - i) * 60_000).toISOString(),
      receivedAt: new Date(now - (n - 1 - i) * 60_000).toISOString(),
      sequence: i,
      qualityStatus: "good" as const,
      payload: JSON.stringify({ heart_rate_bpm: v }),
    })),
  );
}

const evidence = {
  sourceIds: ["telemetry:test..test"],
  dataKind: "simulated" as const,
  quality: "valid" as const,
};

beforeAll(async () => {
  scheduler = await import("../src/clinical/scheduler");
  ({ findingsService: findings } = await import("../src/clinical/findings"));
  ({ cardioAgent } = await import("../src/clinical/agents"));
  ({ telemetryRepo } = await import("../src/db/repositories/telemetry"));
  ({ clinicalDb } = await import("../src/db/clinicalClient"));
  schema = await import("../src/db/schema/clinical");
  ({ eq, and } = await import("drizzle-orm"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("bucket computation", () => {
  test("intervalDueBucket returns the most recent COMPLETED bucket (UTC)", () => {
    const now = Date.UTC(2026, 10, 16, 10, 32, 45);
    expect(scheduler.intervalDueBucket(now, 5)).toBe("20261116T1025");
    expect(scheduler.intervalDueBucket(Date.UTC(2026, 10, 16, 10, 30, 0), 5)).toBe("20261116T1025");
    expect(scheduler.intervalDueBucket(Date.UTC(2026, 10, 16, 10, 29, 59), 5)).toBe("20261116T1020");
  });

  test("dailyDueBucket: before at → null, at/after → local yyyymmdd", () => {
    const before = new Date(2026, 10, 16, 6, 59, 0);
    const after = new Date(2026, 10, 16, 7, 0, 0);
    expect(scheduler.dailyDueBucket(before, "07:00")).toBeNull();
    expect(scheduler.dailyDueBucket(after, "07:00")).toBe("20261116");
  });

  test("manualBucket has manual- prefix and current-minute format", () => {
    expect(scheduler.manualBucket(Date.UTC(2026, 10, 16, 10, 32, 45))).toBe("manual-20261116T1032");
  });
});

describe("claim / retry semantics", () => {
  test("double claim of the same bucket → second is a no-op", () => {
    const now = Date.now();
    const bucket = `claim-test-${now}`;
    const first = scheduler.claimRoutineRun("sky-cardio:interval", "test-claim-noop", bucket, now);
    expect(first.claimed).toBe(true);
    const second = scheduler.claimRoutineRun("sky-cardio:interval", "test-claim-noop", bucket, now);
    expect(second.claimed).toBe(false);
    if (!second.claimed) expect(second.existingStatus).toBe("running");
  });

  test("failed row with attempts=2 → retry claims with attempts=3; attempts=3 → no claim", () => {
    const now = Date.now();
    clinicalDb
      .insert(schema.routineRuns)
      .values({ routineId: "sky-cardio:interval", astronautId: "test-retry-a", bucket: `retry-a-${now}`, status: "failed", attempts: 2, startedAt: now - 60_000, finishedAt: now - 30_000, detail: "boom" })
      .run();
    const retry = scheduler.claimRoutineRun("sky-cardio:interval", "test-retry-a", `retry-a-${now}`, now);
    expect(retry.claimed).toBe(true);
    if (retry.claimed) expect(retry.attempts).toBe(3);

    clinicalDb
      .insert(schema.routineRuns)
      .values({ routineId: "sky-cardio:interval", astronautId: "test-retry-b", bucket: `retry-b-${now}`, status: "failed", attempts: 3, startedAt: now - 60_000, finishedAt: now - 30_000, detail: "boom" })
      .run();
    const exhausted = scheduler.claimRoutineRun("sky-cardio:interval", "test-retry-b", `retry-b-${now}`, now);
    expect(exhausted.claimed).toBe(false);
  });

  test("restart simulation: pre-inserted ok row → due run is a no-op", async () => {
    const now = new Date();
    const dueBucket = scheduler.intervalDueBucket(now.getTime(), 5);
    // Pre-insert 'ok' cho due bucket (interval + daily nếu due) của ayla-reyes TRƯỚC khi tick claim
    const dailyBucket = scheduler.dailyDueBucket(now, "07:00");
    for (const [routineId, bucket] of [["sky-cardio:interval", dueBucket], ...(dailyBucket ? [["sky-cardio:daily", dailyBucket] as const] : [])] as const) {
      const existing = clinicalDb
        .select()
        .from(schema.routineRuns)
        .where(and(eq(schema.routineRuns.routineId, routineId), eq(schema.routineRuns.astronautId, "ayla-reyes"), eq(schema.routineRuns.bucket, bucket)))
        .all();
      if (existing.length === 0) {
        clinicalDb
          .insert(schema.routineRuns)
          .values({ routineId, astronautId: "ayla-reyes", bucket, status: "ok", attempts: 1, startedAt: now.getTime() - 1000, finishedAt: now.getTime() })
          .run();
      }
    }
    // Seed telemetry yellow — nếu restart-recovery hỏng, một finding sẽ được tạo
    seedTelemetry("ayla-reyes", [...cyclicBaseline(132), ...Array(12).fill(84)]);
    const before = clinicalDb.select().from(schema.clinicalFindings).all().filter((f) => f.astronautId === "ayla-reyes").length;
    await scheduler.runDueRoutines(now);
    const rows = clinicalDb
      .select()
      .from(schema.routineRuns)
      .where(and(eq(schema.routineRuns.routineId, "sky-cardio:interval"), eq(schema.routineRuns.astronautId, "ayla-reyes"), eq(schema.routineRuns.bucket, dueBucket)))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("ok");
    const after = clinicalDb.select().from(schema.clinicalFindings).all().filter((f) => f.astronautId === "ayla-reyes").length;
    expect(after).toBe(before); // không tạo finding mới
  });
});

describe("cooldown semantics", () => {
  test("same-severity finding within cooldown is suppressed (routine_runs=cooldown, no new finding)", () => {
    // Tạo finding yellow đầu tiên qua service
    findings.create({
      astronautId: "test-cooldown-a",
      specialistId: "sky-cardio",
      observedAt: new Date().toISOString(),
      metricIds: ["heart_rate_bpm"],
      severity: "yellow",
      summary: "Pre-existing yellow finding for cooldown test (simulated).",
      evidence,
    });
    seedTelemetry("test-cooldown-a", [...cyclicBaseline(132), ...Array(12).fill(84)]);
    const bucket = `cooldown-a-${Date.now()}`;
    const claim = scheduler.claimRoutineRun("sky-cardio:interval", "test-cooldown-a", bucket, Date.now());
    expect(claim.claimed).toBe(true);
    const result = scheduler.executeCardioRoutine(cardioAgent, "test-cooldown-a", "sky-cardio:interval", bucket, new Date());
    expect(result.status).toBe("cooldown");
    expect(result.findingId).toBeUndefined();
    const run = clinicalDb.select().from(schema.routineRuns).where(eq(schema.routineRuns.bucket, bucket)).all()[0];
    expect(run.status).toBe("cooldown");
  });

  test("severity ESCALATION is never suppressed (yellow exists → red is created)", () => {
    findings.create({
      astronautId: "test-cooldown-b",
      specialistId: "sky-cardio",
      observedAt: new Date().toISOString(),
      metricIds: ["heart_rate_bpm"],
      severity: "yellow",
      summary: "Pre-existing yellow finding for escalation test (simulated).",
      evidence,
    });
    seedTelemetry("test-cooldown-b", [...cyclicBaseline(132), ...Array(12).fill(96)]);
    const bucket = `cooldown-b-${Date.now()}`;
    const result = scheduler.executeCardioRoutine(cardioAgent, "test-cooldown-b", "sky-cardio:interval", bucket, new Date());
    expect(result.status).toBe("ok");
    expect(result.findingId).toBeTruthy();
    const finding = findings.get(result.findingId!);
    expect(finding?.severity).toBe("red");
  });
});

describe("manual / forced run", () => {
  test("runManualRoutine with unknown routine id → null", () => {
    expect(scheduler.runManualRoutine("sky-unknown:manual", ["ayla-reyes"], new Date())).toBeNull();
  });

  test("runManualRoutine forces a run and applies cooldown", () => {
    seedTelemetry("test-manual", [...cyclicBaseline(132), ...Array(12).fill(84)]);
    const first = scheduler.runManualRoutine("sky-cardio:manual", ["test-manual"], new Date());
    expect(first?.[0].status).toBe("ok");
    expect(first?.[0].findingId).toBeTruthy();
    // Same minute re-run → claim conflict → returns existing status, không tạo finding mới
    const second = scheduler.runManualRoutine("sky-cardio:manual", ["test-manual"], new Date());
    expect(second?.[0].findingId).toBeUndefined();
    // Cooldown: finding yellow vừa tạo → forced run phút sau vẫn cooldown
    const later = new Date(Date.now() + 61_000);
    const third = scheduler.runManualRoutine("sky-cardio:manual", ["test-manual"], later);
    expect(third?.[0].status).toBe("cooldown");
  });
});
