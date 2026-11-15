import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test này: đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào
// src/db/client.ts. Không import tĩnh module nào của src/ — bắt buộc import động trong beforeAll.
//
// Health observation repo dùng chung connection client.ts (không mở connection thứ ba như
// sensors/events/claims), nên khi chạy CẢ suite, client.ts có thể đã bị file test khác
// (astronauts.test.ts) bind vào var/sky.db trước. Vì vậy test chỉ tạo astronaut giả và XOÁ
// chúng trong afterAll (FK cascade xoá observations) — không đụng crew thật và không để lại row.
const dir = mkdtempSync(join(tmpdir(), "sky-health-observations-test-"));
const dbPath = join(dir, "health.db");

process.env.SKY_DB_PATH = dbPath;

const FAKE_ID = "test-cadet";
const EMPTY_ID = "test-cadet-empty";
const MISSING_ID = "nobody-here";
const NOW = new Date("2026-11-15T12:00:00.000Z");

type SeedModule = typeof import("../src/health/seed");
type RoutesModule = typeof import("../src/healthRoutes");
type MetricsModule = typeof import("../src/health/metrics");
type RepoModule = typeof import("../src/db/repositories/healthObservations");
type DbModule = typeof import("../src/db/client");
type SchemaModule = typeof import("../src/db/schema/astronauts");

let seedHealthObservations: SeedModule["seedHealthObservations"];
let buildHealthObservationRows: SeedModule["buildHealthObservationRows"];
let handleHealthRequest: RoutesModule["handleHealthRequest"];
let metricsModule: MetricsModule;
let repo: RepoModule["healthObservationsRepo"];
let dbModule: DbModule["db"];
let astronautsTable: SchemaModule["astronauts"];

const get = (path: string) => handleHealthRequest(new Request(`http://test${path}`));

const round2 = (value: number) => Math.round(value * 100) / 100;

beforeAll(async () => {
  const seed: SeedModule = await import("../src/health/seed");
  seedHealthObservations = seed.seedHealthObservations;
  buildHealthObservationRows = seed.buildHealthObservationRows;

  const routes: RoutesModule = await import("../src/healthRoutes");
  handleHealthRequest = routes.handleHealthRequest;

  metricsModule = await import("../src/health/metrics");
  repo = (await import("../src/db/repositories/healthObservations")).healthObservationsRepo;
  dbModule = (await import("../src/db/client")).db;
  astronautsTable = (await import("../src/db/schema/astronauts")).astronauts;

  // FK health_observations.astronaut_id → astronauts.id: fixture phải là row thật trong bảng.
  const fixtures = [
    [FAKE_ID, "Test Cadet", "TS-99"],
    [EMPTY_ID, "Test Cadet Empty", "TS-98"],
  ] as const;
  for (const [id, name, roleCode] of fixtures) {
    await dbModule
      .insert(astronautsTable)
      .values({ id, name, roleCode, callsign: "Test", bio: "health-observations test fixture" })
      .onConflictDoNothing()
      .run();
  }
});

afterAll(() => {
  // FK cascade xoá luôn observations của hai fixture này. Không rmSync thư mục tmp: nếu
  // client.ts đã bind vào đây (chạy file test lẻ), các file load sau kế thừa connection đó.
  for (const id of [FAKE_ID, EMPTY_ID]) {
    try {
      dbModule.delete(astronautsTable).where(eq(astronautsTable.id, id)).run();
    } catch {
      // DB tmp đã đóng/không ghi được — test đã xong, không che giấu assertion nào.
    }
  }
  delete process.env.SKY_DB_PATH;
});

// Thư mục tmp không xoá được trong afterAll (file load sau có thể vẫn dùng connection client.ts)
// và `bun test` hard-exit nên handler "exit" không chạy — thay vào đó dọn thư mục cũ hơn 1 giờ
// ngay lúc module load, để /tmp không phình dần mà không đụng một lần chạy song song.
for (const entry of readdirSync(tmpdir())) {
  if (!entry.startsWith("sky-health-observations-test-")) continue;
  const stale = join(tmpdir(), entry);
  try {
    if (Date.now() - statSync(stale).mtimeMs > 60 * 60 * 1000) rmSync(stale, { recursive: true, force: true });
  } catch {
    // thư mục biến mất giữa chừng — bỏ qua.
  }
}

describe("health observation generator (pure, deterministic)", () => {
  test("11 metric × 35 ngày, đúng cadence ngày, đủ enum contract", () => {
    const rows = buildHealthObservationRows("ghost-crew", { now: NOW });
    expect(rows.length).toBe(metricsModule.HEALTH_METRIC_IDS.length * 35);
    expect(metricsModule.HEALTH_METRIC_IDS.length).toBe(11);
    // energy_balance là derived, không bao giờ được lưu.
    expect(rows.some((row) => row.metric === "energy_balance")).toBe(false);

    const byMetric = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byMetric.get(row.metric) ?? [];
      list.push(row);
      byMetric.set(row.metric, list);
    }
    expect(byMetric.size).toBe(11);

    const specByMetric = new Map(metricsModule.HEALTH_METRIC_SPECS.map((spec) => [spec.metric, spec]));
    for (const [metric, list] of byMetric) {
      expect(list.length).toBe(35);
      const spec = specByMetric.get(metric)!;
      expect(spec).toBeDefined();
      // Tăng dần, đúng một row/ngày UTC.
      for (let i = 1; i < list.length; i += 1) {
        const delta = new Date(list[i].ts).getTime() - new Date(list[i - 1].ts).getTime();
        expect(delta).toBe(86_400_000);
        expect(list[i].ts > list[i - 1].ts).toBe(true);
      }
      expect(list[0].ts).toBe("2026-10-12T00:00:00.000Z");
      expect(list[34].ts).toBe("2026-11-15T00:00:00.000Z");
      for (const row of list) {
        expect(row.astronautId).toBe("ghost-crew");
        expect(row.unit).toBe(spec.unit);
        expect(row.method).toBe(spec.method);
        expect(row.quality).toBe("valid");
        expect(row.source).toBe("synthetic");
        expect(row.confidence).toBeGreaterThan(0);
        expect(row.confidence).toBeLessThanOrEqual(1);
        expect(Number.isFinite(row.value!)).toBe(true);
      }
    }
  });

  test("cùng input → cùng chuỗi giá trị (deterministic)", () => {
    const a = buildHealthObservationRows("ghost-crew", { now: NOW });
    const b = buildHealthObservationRows("ghost-crew", { now: NOW });
    expect(a).toEqual(b);
    // Seed khác astronaut → chuỗi khác.
    const c = buildHealthObservationRows("other-crew", { now: NOW });
    expect(c.map((row) => row.value)).not.toEqual(a.map((row) => row.value));
  });

  test("baseline muscle_mass scale theo crew (hằng số), drift −0.5%", () => {
    expect(metricsModule.baselineFor("muscle_mass", "ayla-reyes")).toBe(61.4);
    expect(metricsModule.baselineFor("muscle_mass", "lena-fischer")).toBe(47.2);
    expect(metricsModule.baselineFor("muscle_mass", "yuki-tanaka")).toBe(63);
    // Astronaut ngoài roster → baseline gốc.
    expect(metricsModule.baselineFor("muscle_mass", "ghost-crew")).toBe(61.4);
    // Các metric khác dùng baseline phẳng.
    expect(metricsModule.baselineFor("heart_rate_bpm", "lena-fischer")).toBe(68);

    const lena = buildHealthObservationRows("lena-fischer", { now: NOW }).filter((row) => row.metric === "muscle_mass");
    expect(lena.length).toBe(35);
    expect(lena[34].value!).toBeLessThan(lena[0].value!);
    expect(lena[34].value!).toBeGreaterThan(46.5);
    expect(lena[34].value!).toBeLessThan(47.3);
  });

  test("drift/hướng: muscle_strength dưới baseline, body_fat +, HRV −", () => {
    const rows = buildHealthObservationRows("ayla-reyes", { now: NOW });
    const series = (metric: string) => rows.filter((row) => row.metric === metric).map((row) => row.value!);
    const mean = (list: number[]) => list.reduce((acc, value) => acc + value, 0) / list.length;

    const strength = series("muscle_strength");
    // Trôi −1.5% trên cửa sổ: giá trị ngày cuối bám baseline*(1+drift) trong ±5σ nhiễu.
    const expectedStrengthLast = 88 * (1 + metricsModule.HEALTH_TUNING.drift.muscleStrengthPct);
    expect(Math.abs(strength[34] - expectedStrengthLast)).toBeLessThan(5 * metricsModule.HEALTH_TUNING.noise.muscleStrength);
    expect(Math.min(...strength)).toBeGreaterThan(80);
    expect(Math.max(...strength)).toBeLessThan(92);

    const fat = series("body_fat");
    expect(mean(fat.slice(28))).toBeGreaterThan(mean(fat.slice(0, 7)));
    expect(fat[34]).toBeGreaterThan(17.6);
    expect(fat[34]).toBeLessThan(18.9);

    const hrv = series("hrv_ms");
    expect(mean(hrv.slice(0, 7)) - mean(hrv.slice(28))).toBeGreaterThan(2);

    const sleep = series("sleep_duration");
    expect(Math.min(...sleep)).toBeGreaterThanOrEqual(6.2);
    expect(Math.max(...sleep)).toBeLessThanOrEqual(8.5);
  });

  test("nhịp tuần: exercise_minutes cao Mon/Wed/Fri, thấp ngày nghỉ", () => {
    const rows = buildHealthObservationRows("ghost-crew", { now: NOW }).filter(
      (row) => row.metric === "exercise_minutes",
    );
    const session = rows.filter((row) => [1, 3, 5].includes(new Date(row.ts).getUTCDay()));
    const rest = rows.filter((row) => ![1, 3, 5].includes(new Date(row.ts).getUTCDay()));
    expect(session.length).toBeGreaterThan(0);
    expect(rest.length).toBeGreaterThan(0);
    const mean = (list: typeof rows) => list.reduce((acc, row) => acc + row.value!, 0) / list.length;
    expect(mean(session) - mean(rest)).toBeGreaterThan(8);
    // Clamp 0..120 của simulator.
    for (const row of rows) {
      expect(row.value!).toBeGreaterThanOrEqual(0);
      expect(row.value!).toBeLessThanOrEqual(120);
    }
  });

  test("calories: burned/intake quanh tuning baseline, không phải giá trị âm", () => {
    const rows = buildHealthObservationRows("ghost-crew", { now: NOW });
    const burned = rows.filter((row) => row.metric === "calories_burned").map((row) => row.value!);
    const intake = rows.filter((row) => row.metric === "calories_intake").map((row) => row.value!);
    expect(Math.min(...burned)).toBeGreaterThan(1900);
    expect(Math.max(...burned)).toBeLessThan(2800);
    expect(Math.min(...intake)).toBeGreaterThan(2100);
    expect(Math.max(...intake)).toBeLessThan(2800);
  });
});

describe("health observation repo + seed (idempotent)", () => {
  test("seed một astronaut giả → 11 series × 35 rows", async () => {
    const result = await seedHealthObservations({ astronautIds: [FAKE_ID], now: NOW });
    expect(result).toEqual({ inserted: 385, skipped: 0 });

    expect(await repo.countByMetric(FAKE_ID, "muscle_mass")).toBe(35);
    expect(await repo.countByMetric(FAKE_ID, "energy_balance")).toBe(0);

    const latest = await repo.latestByMetric(FAKE_ID);
    expect(latest.length).toBe(11);
    expect(latest.every((row) => row.ts === "2026-11-15T00:00:00.000Z")).toBe(true);
  });

  test("gọi lại → no-op (không nhân đôi dữ liệu)", async () => {
    const again = await seedHealthObservations({ astronautIds: [FAKE_ID], now: NOW });
    expect(again).toEqual({ inserted: 0, skipped: 11 });
    expect(await repo.countByMetric(FAKE_ID, "muscle_mass")).toBe(35);
  });

  test("byAstronautMetric: 30 điểm gần nhất, tăng dần theo ts", async () => {
    const rows = await repo.byAstronautMetric(FAKE_ID, "hrv_ms", 30);
    expect(rows.length).toBe(30);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].ts > rows[i - 1].ts).toBe(true);
    }
    expect(rows[29].ts).toBe("2026-11-15T00:00:00.000Z");
  });
});

describe("health REST API", () => {
  test("GET /api/health/performance/:id → shape đầy đủ, điểm tăng dần", async () => {
    const res = await get(`/api/health/performance/${FAKE_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      astronautId: string;
      asOf: string;
      metrics: Array<{
        metric: string;
        unit: string;
        latest: number;
        delta30d: number;
        points: number[];
        baseline: number;
        method: string;
        quality: string;
        source: string;
      }>;
      derived: { energy_balance?: number };
    };

    expect(body.astronautId).toBe(FAKE_ID);
    expect(body.asOf).toBe("2026-11-15T00:00:00.000Z");
    expect(body.metrics.length).toBe(11);
    expect(new Set(body.metrics.map((m) => m.metric))).toEqual(new Set(metricsModule.HEALTH_METRIC_IDS));

    for (const metric of body.metrics) {
      expect(metric.unit.length).toBeGreaterThan(0);
      expect(metric.points.length).toBe(30);
      expect(metric.points.every((value) => typeof value === "number")).toBe(true);
      expect(metric.latest).toBe(metric.points[29]);
      expect(metric.delta30d).toBe(round2(metric.latest - metric.points[0]));
      expect(metric.baseline).toBeGreaterThan(0);
      expect(metricsModule.OBSERVATION_METHODS as readonly string[]).toContain(metric.method);
      expect(metric.quality).toBe("valid");
      expect(metric.source).toBe("synthetic");
    }

    const burned = body.metrics.find((m) => m.metric === "calories_burned")!;
    const intake = body.metrics.find((m) => m.metric === "calories_intake")!;
    expect(body.derived.energy_balance).toBe(Math.round(intake.latest - burned.latest));
  });

  test("performance astronaut lạ → 404; id rỗng → 400", async () => {
    const missing = await get(`/api/health/performance/${MISSING_ID}`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ ok: false, error: "unknown_astronaut" });

    const blank = await get("/api/health/performance/%20");
    expect(blank.status).toBe(400);
    expect(await blank.json()).toEqual({ ok: false, error: "bad_astronaut" });
  });

  test("astronaut chưa có dữ liệu → 200 rỗng, không 404 (UI handle gracefully)", async () => {
    const res = await get(`/api/health/performance/${EMPTY_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { astronautId: string; asOf: string; metrics: unknown[]; derived: unknown };
    expect(body.astronautId).toBe(EMPTY_ID);
    expect(body.metrics).toEqual([]);
    expect(body.derived).toEqual({});
    expect(Number.isNaN(Date.parse(body.asOf))).toBe(false);
  });

  test("GET /api/health/observations → mảng row thô mới nhất trước", async () => {
    const res = await get(`/api/health/observations?astronautId=${FAKE_ID}&metric=hrv_ms`);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{ ts: string; metric: string; value: number; method: string }>;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(35);
    expect(rows.every((row) => row.metric === "hrv_ms")).toBe(true);
    expect(rows[0].ts).toBe("2026-11-15T00:00:00.000Z");
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].ts < rows[i - 1].ts).toBe(true);
    }

    const capped = (await (await get(`/api/health/observations?astronautId=${FAKE_ID}&limit=10`)).json()) as unknown[];
    expect(capped.length).toBe(10);

    const unknown = (await (await get("/api/health/observations?astronautId=ghost")).json()) as unknown[];
    expect(unknown).toEqual([]);

    const all = (await (await get("/api/health/observations")).json()) as unknown[];
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeLessThanOrEqual(500);
  });

  test("observations: sai query → 400 bad_query", async () => {
    const cases = [
      "?limit=501",
      "?limit=0",
      "?limit=abc",
      "?metric=energy_balance",
      "?metric=not_a_metric",
      "?astronautId=",
    ];
    for (const query of cases) {
      const res = await get(`/api/health/observations${query}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: "bad_query" });
    }
  });

  test("path/method lạ → null để server.ts fall-through", async () => {
    expect(await handleHealthRequest(new Request("http://test/api/health/unknown"))).toBeNull();
    expect(
      await handleHealthRequest(new Request(`http://test/api/health/performance/${FAKE_ID}`, { method: "POST" })),
    ).toBeNull();
    expect(
      await handleHealthRequest(new Request("http://test/api/health/observations", { method: "POST" })),
    ).toBeNull();
  });
});
