import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test này. Bind SKY_DB_PATH trước MỌI import chạm src/db/*.
const dir = mkdtempSync(join(tmpdir(), "sky-clinical-cardio-"));
process.env.SKY_DB_PATH = join(dir, "cardio.db");

type CardioModule = typeof import("../src/clinical/cardio");
type TelemetryRepoModule = typeof import("../src/db/repositories/telemetry");

let cardio: CardioModule;
let telemetryRepo: TelemetryRepoModule["telemetryRepo"];
let clinicalDb: typeof import("../src/db/clinicalClient")["clinicalDb"];
let schema: typeof import("../src/db/schema/clinical");

beforeAll(async () => {
  cardio = await import("../src/clinical/cardio");
  ({ telemetryRepo } = await import("../src/db/repositories/telemetry"));
  ({ clinicalDb } = await import("../src/db/clinicalClient"));
  schema = await import("../src/db/schema/clinical");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

// --- pure detector fixtures ---
function hrSamples(values: number[], startMs = Date.now() - values.length * 60_000) {
  return values.map((v, i) => ({
    value: v,
    observedAt: new Date(startMs + i * 60_000).toISOString(),
    observedAtMs: startMs + i * 60_000,
    quality: "valid" as const,
    eventId: `ev-${i}`,
  }));
}
const cyclicBaseline = (n: number) => Array.from({ length: n }, (_, i) => [64, 68, 72][i % 3]);

function seedTelemetry(astronautId: string, values: number[], ageMinutesNewest = 1) {
  const now = Date.now() - ageMinutesNewest * 60_000;
  const n = values.length;
  telemetryRepo.insertBatch(
    values.map((v, i) => ({
      eventId: `test-${astronautId}-${i}-${crypto.randomUUID().slice(0, 8)}`,
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

describe("detectCardio (pure rule engine)", () => {
  test("normal cyclic window → green", () => {
    const result = cardio.detectCardio(hrSamples(cyclicBaseline(72)));
    expect(result.severity).toBe("green");
    expect(result.estimator).toBe("mad");
  });

  test("sustained shift to 84 → yellow (sustained ≥ 2.5σ band, 12 samples)", () => {
    const result = cardio.detectCardio(hrSamples([...cyclicBaseline(132), ...Array(12).fill(84)]));
    expect(result.severity).toBe("yellow");
    expect(result.trailingRun).toBeGreaterThanOrEqual(cardio.CARDIO_V1_SUSTAINED_RUN);
  });

  test("large sustained shift to 96 → red (single-sample ≥ 4.5σ)", () => {
    const result = cardio.detectCardio(hrSamples([...cyclicBaseline(132), ...Array(12).fill(96)]));
    expect(result.severity).toBe("red");
  });

  test("constant window → unknown (degenerate baseline, NOT green)", () => {
    const result = cardio.detectCardio(hrSamples(Array(30).fill(68)));
    expect(result.severity).toBe("unknown");
    expect(result.estimator).toBe("degenerate");
  });
});

describe("analyzeAstronautCardio (telemetry-backed)", () => {
  test("quality-failed window (too few samples) → gate fails, no detection", () => {
    seedTelemetry("test-quality-few", cyclicBaseline(5));
    const analysis = cardio.analyzeAstronautCardio("test-quality-few");
    expect(analysis.quality.ok).toBe(false);
    expect(analysis.quality.reason).toBe("too_few_samples");
    expect(analysis.detection).toBeUndefined();
  });

  test("stale window → gate fails with reason stale", () => {
    seedTelemetry("test-stale", cyclicBaseline(30), 60); // newest sample 60 phút tuổi
    const analysis = cardio.analyzeAstronautCardio("test-stale");
    expect(analysis.quality.ok).toBe(false);
    expect(analysis.quality.reason).toBe("stale");
  });

  test("sustained shift window → yellow detection with simulated evidence", () => {
    seedTelemetry("test-yellow-analyze", [...cyclicBaseline(132), ...Array(12).fill(84)]);
    const analysis = cardio.analyzeAstronautCardio("test-yellow-analyze");
    expect(analysis.quality.ok).toBe(true);
    expect(analysis.detection?.severity).toBe("yellow");
    const evidence = cardio.buildCardioEvidence(analysis.validSamples, analysis.detection!, "valid");
    expect(evidence.dataKind).toBe("simulated");
    expect(evidence.modelVersion).toBe("cardio-v1");
    expect(evidence.quality).toBe("valid");
    expect(evidence.thresholdSource).toContain("10.1016/j.jesp.2013.03.013");
    expect(evidence.sourceIds[0]).toMatch(/^telemetry:.*\.\..*$/);
  });

  test("normal window → green detection", () => {
    seedTelemetry("test-green-analyze", cyclicBaseline(60));
    const analysis = cardio.analyzeAstronautCardio("test-green-analyze");
    expect(analysis.quality.ok).toBe(true);
    expect(analysis.detection?.severity).toBe("green");
  });
});

describe("executeCardioRoutine (finding persistence)", () => {
  test("green window → routine ok, NOTHING persisted", async () => {
    const { cardioAgent } = await import("../src/clinical/agents");
    const { executeCardioRoutine } = await import("../src/clinical/scheduler");
    seedTelemetry("test-green-persist", cyclicBaseline(60));
    const bucketGreen = `test-green-${Date.now()}`;
    const { claimRoutineRun } = await import("../src/clinical/scheduler");
    expect(claimRoutineRun("sky-cardio:interval", "test-green-persist", bucketGreen, Date.now()).claimed).toBe(true);
    const before = clinicalDb.select().from(schema.clinicalFindings).all().length;
    const result = executeCardioRoutine(cardioAgent, "test-green-persist", "sky-cardio:interval", bucketGreen, new Date());
    expect(result.status).toBe("ok");
    expect(result.findingId).toBeUndefined();
    const after = clinicalDb.select().from(schema.clinicalFindings).all().length;
    expect(after).toBe(before);
  });

  test("yellow window → finding persisted with dataKind simulated + requiresMedicalReview", async () => {
    const { cardioAgent } = await import("../src/clinical/agents");
    const { executeCardioRoutine } = await import("../src/clinical/scheduler");
    seedTelemetry("test-yellow-persist", [...cyclicBaseline(132), ...Array(12).fill(84)]);
    const bucketYellow = `test-yellow-${Date.now()}`;
    const yellowClaim = (await import("../src/clinical/scheduler")).claimRoutineRun("sky-cardio:interval", "test-yellow-persist", bucketYellow, Date.now());
    expect(yellowClaim.claimed).toBe(true);
    const result = executeCardioRoutine(cardioAgent, "test-yellow-persist", "sky-cardio:interval", bucketYellow, new Date());
    expect(result.status).toBe("ok");
    expect(result.findingId).toBeTruthy();
    const { eq } = await import("drizzle-orm");
    const rows = clinicalDb.select().from(schema.clinicalFindings).where(eq(schema.clinicalFindings.id, result.findingId!)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("yellow");
    expect(rows[0].requiresMedicalReview).toBe(true);
    expect(rows[0].status).toBe("new");
    const evidence = JSON.parse(rows[0].evidence);
    expect(evidence.dataKind).toBe("simulated");
    expect(rows[0].summary.toLowerCase()).toContain("simulated");
    expect(rows[0].summary.length).toBeLessThanOrEqual(400);
  });

  test("quality-failed window → routine_runs records skipped_quality, no finding", async () => {
    const { cardioAgent } = await import("../src/clinical/agents");
    const { executeCardioRoutine } = await import("../src/clinical/scheduler");
    // test-skip-quality-unique không có telemetry → gate too_few_samples
    const bucket = `test-skip-${Date.now()}`;
    const claim = (await import("../src/clinical/scheduler")).claimRoutineRun("sky-cardio:interval", "test-skip-quality-unique", bucket, Date.now());
    expect(claim.claimed).toBe(true);
    const result = executeCardioRoutine(cardioAgent, "test-skip-quality-unique", "sky-cardio:interval", bucket, new Date());
    expect(result.status).toBe("skipped_quality");
    const { eq } = await import("drizzle-orm");
    const rows = clinicalDb.select().from(schema.routineRuns).where(eq(schema.routineRuns.bucket, bucket)).all();
    expect(rows[0]?.status).toBe("skipped_quality");
  });
});
