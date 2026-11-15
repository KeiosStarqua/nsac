import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng trước mọi import src/* (import động trong beforeAll): tránh bind vào var/sky.db và
// tránh CANTOPEN khi file test trước để lại SKY_DB_PATH trỏ vào tmp dir đã xoá.
const dir = mkdtempSync(join(tmpdir(), "sky-health-live-test-"));
process.env.SKY_DB_PATH = join(dir, "health-live.db");

// PR2 — /api/health/live (sim/seed/none) + performance.live; PR4 — facts vào change_events.
// Dùng singleton thật (db, eventsDb) như health-observations.test.ts: tạo astronaut giả và
// dọn sạch trong afterAll, không đụng crew thật.

type RoutesModule = typeof import("../src/healthRoutes");
type EventsModule = typeof import("../src/eventsRoutes");
type LiveRepoModule = typeof import("../src/db/repositories/healthLive");
type DbModule = typeof import("../src/db/client");
type SchemaModule = typeof import("../src/db/schema/astronauts");
type ObsRepoModule = typeof import("../src/db/repositories/healthObservations");
type EngineModule = typeof import("../src/sensors/engine");
type PublishModule = typeof import("../src/health/projector");
type ClientModule = typeof import("../src/clinical/publish");
type AstronautsRepoModule = typeof import("../src/db/repositories/astronauts");

let handleHealthRequest: RoutesModule["handleHealthRequest"];
let handleEventsRequest: EventsModule["handleEventsRequest"];
let healthLiveRepo: LiveRepoModule["healthLiveRepo"];
let db: DbModule["db"];
let astronauts: SchemaModule["astronauts"];
let healthObservationsRepo: ObsRepoModule["healthObservationsRepo"];
let simulationEngine: EngineModule["simulationEngine"];
let publishHealthFact: PublishModule["publishHealthFact"];
let publishChangeEvent: ClientModule["publishChangeEvent"];
let astronautsRepo: AstronautsRepoModule["astronautsRepo"];

const CADET = "test-live-cadet";

const getHealth = (path: string) => handleHealthRequest(new Request(`http://test${path}`));
const getEvents = (path: string) => handleEventsRequest(new Request(`http://test${path}`));

beforeAll(async () => {
  ({ handleHealthRequest } = await import("../src/healthRoutes"));
  ({ handleEventsRequest } = await import("../src/eventsRoutes"));
  ({ healthLiveRepo } = await import("../src/db/repositories/healthLive"));
  ({ db } = await import("../src/db/client"));
  ({ astronauts } = await import("../src/db/schema/astronauts"));
  ({ healthObservationsRepo } = await import("../src/db/repositories/healthObservations"));
  ({ simulationEngine } = await import("../src/sensors/engine"));
  ({ publishHealthFact } = await import("../src/health/projector"));
  ({ publishChangeEvent } = await import("../src/clinical/publish"));
  ({ astronautsRepo } = await import("../src/db/repositories/astronauts"));

  // Crew chuẩn phải tồn tại để GET /api/health/live trả đủ roster (server.ts seed lúc boot).
  await astronautsRepo.seed();
  try {
    simulationEngine.stop();
  } catch {
    /* engine chưa chạy */
  }
  await db
    .insert(astronauts)
    .values({ id: CADET, name: "Test Live Cadet", roleCode: "CDR-99", callsign: "Test", bio: null })
    .onConflictDoNothing()
    .run();
});

afterAll(() => {
  try {
    simulationEngine.stop();
  } catch {
    /* ignore */
  }
  try {
    healthLiveRepo.clear();
    db.delete(astronauts).where(eq(astronauts.id, CADET)).run();
  } catch {
    /* DB có thể đã đóng — dọn dẹp best-effort */
  }
  delete process.env.SKY_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe("GET /api/health/live/:astronautId", () => {
  test("unknown astronaut → 404, bad id → 400", async () => {
    const missing = await getHealth("/api/health/live/nobody-here");
    expect(missing!.status).toBe(404);
    expect(((await missing!.json()) as { error: string }).error).toBe("unknown_astronaut");

    const bad = await getHealth("/api/health/live/%20");
    expect(bad!.status).toBe(400);
  });

  test("none: no live rows and no seeded observations", async () => {
    const res = await getHealth(`/api/health/live/${CADET}`);
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as {
      ok: boolean;
      live: boolean;
      updatedAt: string | null;
      source: string;
      metrics: Record<string, unknown>;
    };
    expect(body.ok).toBe(true);
    expect(body.live).toBe(false);
    expect(body.updatedAt).toBeNull();
    expect(body.source).toBe("none");
    expect(body.metrics).toEqual({});
  });

  test("seed: health_current empty but historical observations exist", async () => {
    healthObservationsRepo.insertMany([
      {
        ts: "2026-11-15T00:00:00.000Z",
        astronautId: CADET,
        metric: "heart_rate_bpm",
        value: 62,
        unit: "bpm",
        source: "synthetic",
        method: "simulated",
        quality: "valid",
        confidence: 0.6,
      },
      {
        ts: "2026-11-15T00:00:00.000Z",
        astronautId: CADET,
        metric: "hrv_ms",
        value: 48,
        unit: "ms",
        source: "synthetic",
        method: "simulated",
        quality: "valid",
        confidence: 0.6,
      },
    ]);

    const res = await getHealth(`/api/health/live/${CADET}`);
    const body = (await res!.json()) as {
      live: boolean;
      source: string;
      updatedAt: string | null;
      metrics: Record<string, { value: number; unit: string; quality: string }>;
    };
    expect(body.live).toBe(false);
    expect(body.source).toBe("seed");
    expect(body.updatedAt).toBe("2026-11-15T00:00:00.000Z");
    expect(body.metrics.heart_rate_bpm).toEqual({ value: 62, unit: "bpm", quality: "valid" });
    expect(body.metrics.hrv_ms.value).toBe(48);

    // Dữ liệu seed không được coi là live measurement: health_current vẫn rỗng.
    expect(healthLiveRepo.currentByAstronaut(CADET)).toEqual([]);
  });

  test("sim: health_current rows appear, live only while the simulator runs", async () => {
    const now = Date.now();
    healthLiveRepo.upsertCurrent([
      {
        astronautId: CADET,
        metric: "heart_rate_bpm",
        value: 71.5,
        unit: "bpm",
        quality: "valid",
        source: "sim",
        measuredAt: new Date(now).toISOString(),
        updatedAt: now,
      },
      {
        astronautId: CADET,
        metric: "spo2_pct",
        value: 97.8,
        unit: "%",
        quality: "suspect",
        source: "sim",
        measuredAt: new Date(now).toISOString(),
        updatedAt: now,
      },
    ]);

    // Engine chưa chạy → sim data nhưng live:false.
    let res = await getHealth(`/api/health/live/${CADET}`);
    let body = (await res!.json()) as { live: boolean; source: string; metrics: Record<string, { quality: string }> };
    expect(body.source).toBe("sim");
    expect(body.live).toBe(false);
    expect(body.metrics.spo2_pct.quality).toBe("suspect");

    simulationEngine.start({ scenario: "normal", seed: "live-test", manual: true, startTimeMs: Date.UTC(2026, 10, 15) });
    res = await getHealth(`/api/health/live/${CADET}`);
    body = (await res!.json()) as { live: boolean; source: string; updatedAt: string | null };
    expect(body.live).toBe(true);
    expect(body.source).toBe("sim");
    expect(typeof body.updatedAt).toBe("string");
    simulationEngine.stop();
  });

  test("GET /api/health/live → array of the crew with the same shape", async () => {
    const res = await getHealth("/api/health/live");
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as Array<{
      ok: boolean;
      astronautId: string;
      live: boolean;
      source: string;
      updatedAt: string | null;
      metrics: Record<string, unknown>;
    }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(6);
    const cadet = body.find((entry) => entry.astronautId === CADET)!;
    expect(cadet).toBeDefined();
    expect(cadet.ok).toBe(true);
    expect(typeof cadet.live).toBe("boolean");
    expect(typeof cadet.source).toBe("string");
    expect(typeof cadet.metrics).toBe("object");
    for (const entry of body) {
      expect(["sim", "seed", "none"]).toContain(entry.source);
    }
  });

  test("performance response carries the additive live object", async () => {
    const res = await getHealth(`/api/health/performance/${CADET}`);
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as {
      astronautId: string;
      metrics: unknown[];
      derived: Record<string, unknown>;
      live: { live: boolean; source: string; updatedAt: string | null; metrics: Record<string, unknown> };
    };
    expect(body.astronautId).toBe(CADET);
    expect(Array.isArray(body.metrics)).toBe(true);
    expect(body.live).toBeDefined();
    expect(body.live.source).toBe("sim");
    expect(Object.keys(body.live.metrics).length).toBeGreaterThan(0);
  });
});

describe("facts reach change_events", () => {
  test("publishHealthFact lands a v2 health.fact.updated row readable qua /api/events", async () => {
    const fact = {
      factId: "cardiovascular_anomaly:test-live-cadet:1234",
      missionId: "SIM-001",
      crewId: CADET,
      category: "cardiovascular" as const,
      rule: "cardiovascular_anomaly" as const,
      status: "active" as const,
      severity: "yellow" as const,
      sourceMode: "synthetic" as const,
      quality: "valid" as const,
      observedAt: "2026-11-15T06:00:00.000Z",
      evidenceEventIds: ["ev-1", "ev-2"],
      summary: "Heart rate above the crew trailing median (simulated)",
    };
    const id = publishHealthFact(fact);
    expect(id).toBeGreaterThan(0);

    const res = await getEvents("/api/events?topics=health.fact.updated&limit=50");
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as {
      events: Array<{ id: number; topic: string; source: string; astronautId: string | null; summary: string; payload: Record<string, unknown> }>;
    };
    const row = body.events.find((event) => event.payload.factId === fact.factId)!;
    expect(row).toBeDefined();
    expect(row.topic).toBe("health.fact.updated");
    expect(row.source).toBe("simulation");
    expect(row.astronautId).toBe(CADET);
    expect(row.summary.length).toBeGreaterThan(0);
    expect(row.payload).toMatchObject({
      missionId: "SIM-001",
      crewId: CADET,
      category: "cardiovascular",
      rule: "cardiovascular_anomaly",
      status: "active",
      severity: "yellow",
      sourceMode: "synthetic",
      quality: "valid",
    });
    expect(row.payload.evidenceEventIds).toEqual(["ev-1", "ev-2"]);
    // KHÔNG có raw reading / summary trong payload.
    expect(row.payload.summary).toBeUndefined();
    expect(row.payload.heart_rate_bpm).toBeUndefined();
  });

  test("legacy health.fact.updated payload vẫn publish được (back-compat)", () => {
    const id = publishChangeEvent("health.fact.updated", null, "osdr-feed", "legacy", {
      fact: "spo2",
      value: 97,
      unit: "%",
    });
    expect(id).toBeGreaterThan(0);
  });
});
