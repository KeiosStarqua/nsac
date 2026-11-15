import { astronautsRepo } from "./db/repositories/astronauts";
import { healthObservationsRepo } from "./db/repositories/healthObservations";
import {
  baselineFor,
  HEALTH_METRIC_SPECS,
  type ObservationMethod,
  type ObservationQuality,
} from "./health/metrics";
import {
  astronautIdSchema,
  observationListQuerySchema,
  type HealthMetricSummary,
  type HealthPerformanceResponse,
} from "./healthSchemas";

// REST cho health observation layer (năng lượng/cơ/giấc ngủ/nước). Dữ liệu synthetic, không
// ngưỡng lâm sàng, không alert: backend chỉ trả số + method/quality/source để UI/agent diễn giải.
// Lỗi trả JSON { ok:false, error } theo style eventsRoutes/sensors/routes.ts. Path lạ → null.

/** Số điểm mỗi series trong performance response (Cửa sổ 30 ngày cho delta30d). */
const POINTS_PER_SERIES = 30;
const PERFORMANCE_PATH = /^\/api\/health\/performance\/([^/]+)$/;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Xử lý `/api/health/*`. Trả `null` khi request không thuộc health để server.ts fall-through
 * về 404 như hiện có.
 */
export async function handleHealthRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);

  if (url.pathname === "/api/health/observations") {
    if (req.method !== "GET") return null;
    return listObservations(url);
  }

  const match = url.pathname.match(PERFORMANCE_PATH);
  if (match) {
    if (req.method !== "GET") return null;
    return performance(decodeURIComponent(match[1]));
  }

  return null;
}

/**
 * GET /api/health/performance/:astronautId
 * 404 khi astronaut không tồn tại; 200 `{ metrics: [], derived: {} }` khi tồn tại nhưng chưa seed.
 */
async function performance(rawAstronautId: string): Promise<Response> {
  const parsed = astronautIdSchema.safeParse(rawAstronautId);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "bad_astronaut" }, { status: 400 });
  }
  const astronautId = parsed.data;

  const astronaut = await astronautsRepo.get(astronautId);
  if (!astronaut) {
    return Response.json({ ok: false, error: "unknown_astronaut" }, { status: 404 });
  }

  const metrics: HealthMetricSummary[] = [];
  let asOf = "";

  // Thứ tự series = thứ tự catalog để response ổn định giữa các lần gọi.
  for (const spec of HEALTH_METRIC_SPECS) {
    const rows = await healthObservationsRepo.byAstronautMetric(astronautId, spec.metric, POINTS_PER_SERIES);
    if (rows.length === 0) continue;

    const latest = rows[rows.length - 1];
    const oldest = rows[0];
    metrics.push({
      metric: spec.metric,
      unit: latest.unit,
      latest: latest.value,
      delta30d: round2(latest.value - oldest.value),
      points: rows.map((row) => row.value),
      baseline: baselineFor(spec.metric, astronautId),
      method: latest.method as ObservationMethod,
      quality: latest.quality as ObservationQuality,
      source: latest.source,
    });
    if (latest.ts > asOf) asOf = latest.ts;
  }

  const derived: HealthPerformanceResponse["derived"] = {};
  const burned = metrics.find((m) => m.metric === "calories_burned");
  const intake = metrics.find((m) => m.metric === "calories_intake");
  if (burned && intake) {
    derived.energy_balance = Math.round(intake.latest - burned.latest);
  }

  const body: HealthPerformanceResponse = {
    astronautId,
    // asOf = mốc dữ liệu mới nhất; chưa có dữ liệu thì dùng thời điểm trả lời.
    asOf: asOf || new Date().toISOString(),
    metrics,
    derived,
  };
  return Response.json(body);
}

/** GET /api/health/observations — mảng row thô mới nhất trước; sai query → 400 bad_query. */
async function listObservations(url: URL): Promise<Response> {
  const parsed = observationListQuerySchema.safeParse({
    astronautId: url.searchParams.get("astronautId") ?? undefined,
    metric: url.searchParams.get("metric") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ ok: false, error: "bad_query" }, { status: 400 });
  }
  const { astronautId, metric, limit } = parsed.data;
  const rows = await healthObservationsRepo.list({ astronautId, metric, limit });
  // JSON array trực tiếp (không bọc { count, rows }, không stream) — contract đã chốt.
  return Response.json(rows);
}
