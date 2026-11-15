import { z } from "zod";
import {
  HEALTH_METRIC_IDS,
  type HealthMetricId,
  type ObservationMethod,
  type ObservationQuality,
} from "./health/metrics";

// Contract của health observation REST API. Endpoint mở như /api/sensors, /api/claims (demo
// single-box); query validate chặt qua zod để lỗi trả 400 JSON thay vì dữ liệu rác.

/** Chỉ 11 metric được lưu — `energy_balance` là derived nên không nhận qua query/metric seed. */
export const healthMetricSchema = z.enum(HEALTH_METRIC_IDS);

export const astronautIdSchema = z.string().trim().min(1).max(64);

/** GET /api/health/observations — mọi field optional, limit 1..500 (mặc định 500). */
export const observationListQuerySchema = z
  .object({
    astronautId: astronautIdSchema.optional(),
    metric: healthMetricSchema.optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

export interface HealthMetricSummary {
  metric: HealthMetricId;
  unit: string;
  /** Giá trị mới nhất. */
  latest: number;
  /** latest − giá trị cũ nhất trong 30 điểm gần nhất. */
  delta30d: number;
  /** 30 giá trị gần nhất, TĂNG dần theo thời gian. */
  points: number[];
  /** Baseline tuning của simulator cho metric này (riêng muscle_mass scale theo crew). */
  baseline: number;
  method: ObservationMethod;
  quality: ObservationQuality;
  source: string;
}

export interface HealthPerformanceResponse {
  astronautId: string;
  /** ts mới nhất trong dữ liệu trả về (ISO UTC); fallback now khi chưa có dữ liệu. */
  asOf: string;
  /** Rỗng khi astronaut tồn tại nhưng chưa có observation. */
  metrics: HealthMetricSummary[];
  /** energy_balance = latest(calories_intake) − latest(calories_burned); rỗng nếu thiếu vế. */
  derived: { energy_balance?: number };
  /** Live projection (v2) — additive, không đổi các field trên. */
  live?: HealthLiveStatus;
}

/** Một giá trị metric live: chỉ có metric CÓ nguồn telemetry (hrv_ms không bao giờ bị bịa). */
export interface HealthLiveMetric {
  value: number;
  unit: string;
  quality: ObservationQuality;
}

export interface HealthLiveStatus {
  live: boolean;
  /** Wall-clock ISO của lần ingest gần nhất (null khi chưa có dữ liệu sim). */
  updatedAt: string | null;
  source: "sim" | "seed" | "none";
  metrics: Record<string, HealthLiveMetric>;
}

export type HealthLiveResponse = HealthLiveStatus & { ok: true };

export type HealthLiveListEntry = HealthLiveResponse & { astronautId: string };
