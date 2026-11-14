import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test này — đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào
// src/db/sensorsClient.ts, để var/sky.db dùng chung không bao giờ bị đụng (giống events.test.ts).
const dir = mkdtempSync(join(tmpdir(), "sky-sensors-api-test-"));
const dbPath = join(dir, "sensors.db");

process.env.SKY_DB_PATH = dbPath;

type RoutesModule = typeof import("../src/sensors/routes");

let handleSensorsRequest: RoutesModule["handleSensorsRequest"];

const get = (path: string) => handleSensorsRequest(new Request(`http://test${path}`));
const post = (path: string, body?: unknown) =>
  handleSensorsRequest(
    new Request(`http://test${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  const routes: RoutesModule = await import("../src/sensors/routes");
  handleSensorsRequest = routes.handleSensorsRequest;
});

afterAll(async () => {
  // Dừng engine nếu còn chạy, tránh interval treo sau test.
  await post("/api/sensors/sim/stop");
  // Không để SKY_DB_PATH trỏ vào tmp dir sắp xoá — bun test chạy file tuần tự trong một process,
  // file load sau (client.ts) sẽ kế thừa env này và CANTOPEN nếu dir đã mất.
  delete process.env.SKY_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe("sensors REST API", () => {
  test("GET /api/sensors/devices → 38 devices", async () => {
    const res = await get("/api/sensors/devices");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number; devices: Array<{ id: string; simulated: boolean }> };
    expect(body.count).toBe(38);
    expect(body.devices.length).toBe(38);
    expect(body.devices.every((d) => typeof d.id === "string")).toBe(true);
  });

  test("GET /api/sensors/devices/:id → 200 / 404 unknown", async () => {
    const ok = await get("/api/sensors/devices/biomonitor");
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { id: string }).id).toBe("biomonitor");

    const missing = await get("/api/sensors/devices/nope-device");
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as { error: string }).error).toBe("unknown_device");
  });

  test("GET /api/sensors/metrics → catalog với unit + https sourceUrl", async () => {
    const res = await get("/api/sensors/metrics");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      metrics: Array<{ id: string; unit: string; sourceUrl: string }>;
    };
    expect(body.count).toBeGreaterThan(0);
    for (const m of body.metrics) {
      expect(m.unit.length).toBeGreaterThan(0);
      expect(m.sourceUrl.startsWith("https://")).toBe(true);
    }
  });

  test("GET /api/sensors/events → events accumulate sau khi start; stop; reset xoá", async () => {
    // Start ở 100× — mỗi tick 10 ms wall.
    const started = await post("/api/sensors/sim/start", { scenario: "normal", speed: 100, seed: "api-test-seed" });
    expect(started.status).toBe(200);
    const startBody = (await started.json()) as { ok: boolean; running: boolean; simulated: boolean };
    expect(startBody.ok).toBe(true);
    expect(startBody.running).toBe(true);
    expect(startBody.simulated).toBe(true);

    // Chờ events tích lũy trong DB (poll tối đa ~2 s).
    let count = 0;
    for (let i = 0; i < 40; i += 1) {
      await sleep(50);
      const res = await get("/api/sensors/events?limit=5");
      const body = (await res.json()) as { count: number };
      count = body.count;
      if (count >= 5) break;
    }
    expect(count).toBeGreaterThan(0);

    // Status → running.
    const statusRes = await get("/api/sensors/sim/status");
    const status = (await statusRes.json()) as {
      running: boolean;
      scenario: string;
      speed: number;
      missionId: string;
      simulated: boolean;
      startedAt: string | null;
      sequence: Record<string, number>;
    };
    expect(status.running).toBe(true);
    expect(status.scenario).toBe("normal");
    expect(status.speed).toBe(100);
    expect(status.simulated).toBe(true);
    expect(status.startedAt).not.toBeNull();

    // Start lần hai khi đang chạy → 409.
    const again = await post("/api/sensors/sim/start", { scenario: "normal" });
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: string }).error).toBe("already_running");

    // Stop → running false; events vẫn còn trong DB.
    const stopped = await post("/api/sensors/sim/stop");
    expect(stopped.status).toBe(200);
    expect(((await stopped.json()) as { running: boolean }).running).toBe(false);
    const afterStop = (await (await get("/api/sensors/events?limit=10")).json()) as { count: number };
    expect(afterStop.count).toBeGreaterThan(0);

    // Reset → xoá events của mission hiện tại.
    const reset = await post("/api/sensors/sim/reset");
    expect(reset.status).toBe(200);
    const resetBody = (await reset.json()) as { ok: boolean; deleted: number };
    expect(resetBody.ok).toBe(true);
    expect(resetBody.deleted).toBeGreaterThan(0);
    const afterReset = (await (await get("/api/sensors/events?limit=10")).json()) as { count: number };
    expect(afterReset.count).toBe(0);
  });

  test("sensor_fault scenario thiếu fault → 400; fault lạ → 400", async () => {
    const missing = await post("/api/sensors/sim/start", { scenario: "sensor_fault" });
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { error: string }).error).toBe("fault_required");

    const badDevice = await post("/api/sensors/sim/start", {
      scenario: "sensor_fault",
      fault: { deviceId: "not-a-device", kind: "stuck" },
    });
    expect(badDevice.status).toBe(400);
    expect(((await badDevice.json()) as { error: string }).error).toBe("unknown_fault_device");
  });

  test("bad body → 400; unknown method on a sensors path → fall-through null", async () => {
    const garbage = await handleSensorsRequest(
      new Request("http://test/api/sensors/sim/start", { method: "POST", body: "{not json" }),
    );
    expect(garbage!.status).toBe(400);

    const unknown = await handleSensorsRequest(new Request("http://test/api/sensors/nonexistent"));
    expect(unknown).toBeNull();
  });

  test("limit clamp: limit=99999 → tối đa 500 (không crash)", async () => {
    const res = await get("/api/sensors/events?limit=99999");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number };
    expect(body.count).toBeLessThanOrEqual(500);
  });
});
