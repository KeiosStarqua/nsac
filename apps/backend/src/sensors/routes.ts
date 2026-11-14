import { z } from "zod";
import { METRIC_SPECS } from "./metrics";
import { DEVICES, deviceById } from "./registry";
import { sensorsStore } from "./store";
import { simulationEngine, SCENARIOS } from "./engine";
import type { TelemetryEvent } from "./envelope";

// Endpoint mở, không auth — demo single-box (giống /api/claims, /api/events; SPEC §0).
// Dữ liệu luôn là synthetic; consumer phải tự kiểm tra source.mode.
// Lỗi trả { ok:false, error } + HTTP status theo style eventsRoutes.ts. Request lạ → null (fall-through về 404).

const MAX_BODY_BYTES = 8192;

const startBodySchema = z
  .object({
    scenario: z.enum(SCENARIOS).default("normal"),
    speed: z.union([z.literal(1), z.literal(10), z.literal(100)]).default(1),
    missionId: z.string().trim().min(1).max(64).default("SIM-001"),
    crewId: z.string().trim().min(1).max(64).optional(),
    seed: z.string().trim().min(1).max(128).default("sky-sim-1"),
    fault: z
      .object({
        deviceId: z.string().trim().min(1).max(64),
        kind: z.enum(["dropout", "stuck", "drift"]),
        p: z.number().min(0).max(1).optional(),
        driftPerMin: z.number().finite().optional(),
        stuckValue: z.number().finite().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function lenientInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

type TelemetryRow = ReturnType<typeof sensorsStore.recent>[number];

function serializeRow(row: TelemetryRow): TelemetryEvent {
  const payload = safeJsonParse(row.payload);
  return {
    schema_version: "1.0",
    event_id: row.eventId,
    mission_id: row.missionId,
    ...(row.crewId ? { crew_id: row.crewId } : {}),
    device_id: row.deviceId,
    device_type: row.deviceType,
    ...(row.locationId ? { location_id: row.locationId } : {}),
    source: {
      mode: row.sourceMode as TelemetryEvent["source"]["mode"],
      ...(row.datasetId ? { dataset_id: row.datasetId } : {}),
    },
    observed_at: row.observedAt,
    received_at: row.receivedAt,
    sequence: row.sequence,
    quality: { status: row.qualityStatus as TelemetryEvent["quality"]["status"] },
    payload: payload ?? {},
  };
}

/**
 * Xử lý các route /api/sensors/*. Trả về `null` khi path không thuộc sensors
 * để server.ts fall-through như hiện có.
 */
export async function handleSensorsRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);

  if (url.pathname === "/api/sensors/devices") {
    if (req.method !== "GET") return null;
    return Response.json({ count: DEVICES.length, devices: DEVICES });
  }

  const deviceMatch = url.pathname.match(/^\/api\/sensors\/devices\/([^/]+)$/);
  if (deviceMatch) {
    if (req.method !== "GET") return null;
    const device = deviceById(decodeURIComponent(deviceMatch[1]));
    if (!device) return Response.json({ ok: false, error: "unknown_device" }, { status: 404 });
    return Response.json(device);
  }

  if (url.pathname === "/api/sensors/metrics") {
    if (req.method !== "GET") return null;
    return Response.json({ count: METRIC_SPECS.length, metrics: METRIC_SPECS });
  }

  if (url.pathname === "/api/sensors/events") {
    if (req.method !== "GET") return null;
    const deviceId = url.searchParams.get("deviceId")?.trim().slice(0, 64) || undefined;
    const missionId = url.searchParams.get("missionId")?.trim().slice(0, 64) || undefined;
    const limit = lenientInt(url.searchParams.get("limit"), 50, 1, 500);
    const rows = sensorsStore.recent({ deviceId, missionId, limit });
    return Response.json({ count: rows.length, events: rows.map(serializeRow) });
  }

  if (url.pathname === "/api/sensors/sim/start") {
    if (req.method !== "POST") return null;
    return simStart(req);
  }
  if (url.pathname === "/api/sensors/sim/stop") {
    if (req.method !== "POST") return null;
    const status = simulationEngine.stop();
    return Response.json({ ok: true, ...status });
  }
  if (url.pathname === "/api/sensors/sim/reset") {
    if (req.method !== "POST") return null;
    const result = simulationEngine.reset();
    return Response.json(result);
  }
  if (url.pathname === "/api/sensors/sim/status") {
    if (req.method !== "GET") return null;
    return Response.json(simulationEngine.status());
  }

  return null;
}

async function simStart(req: Request): Promise<Response> {
  // Chặn sớm theo Content-Length khi có; luôn kiểm tra lại sau khi đọc body (giống eventsRoutes).
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  // Start cho phép body rỗng — dùng defaults (normal / speed 1 / SIM-001 / sky-sim-1).
  const body = text.trim() === "" ? {} : safeJsonParse(text);
  if (body === undefined) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const parsed = startBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const opts = parsed.data;

  if (simulationEngine.isRunning()) {
    return Response.json({ ok: false, error: "already_running" }, { status: 409 });
  }
  if (opts.scenario === "sensor_fault") {
    if (!opts.fault) {
      return Response.json({ ok: false, error: "fault_required" }, { status: 400 });
    }
    if (!deviceById(opts.fault.deviceId)) {
      return Response.json({ ok: false, error: "unknown_fault_device" }, { status: 400 });
    }
  }

  const status = simulationEngine.start(opts);
  return Response.json({ ok: true, ...status });
}
