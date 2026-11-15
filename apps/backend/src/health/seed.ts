// Generator + seed của health observation layer.
//
// Đặc tính cố định: synthetic, deterministic (PRNG seed theo `${astronautId}|${metric}`), một
// row/ngày cho mỗi metric, cửa sổ 35 ngày gần nhất. Seed idempotent: chỉ ghi khi cặp
// (astronaut, metric) chưa có row nào — restart server không nhân đôi dữ liệu.
//
// Cadence thật ngoài đời không đều (DXA vài tuần/lần, grip strength theo phiên, cân nặng/tuần):
// seed hiện tại emit row hàng ngày cho mọi metric và để cột `method` gánh độ tin của phép đo.
// Mô phỏng cadence thật là out of scope của layer này.
//
// Mọi hằng số tuning + URL nguồn nằm ở health/metrics.ts; file này chỉ áp công thức.

import { astronautsRepo } from "../db/repositories/astronauts";
import {
  healthObservationsRepo,
  type HealthObservationInsert,
} from "../db/repositories/healthObservations";
import { makeGaussian, mulberry32, seedFromString } from "../sensors/prng";
import {
  baselineFor,
  HEALTH_METRIC_SPECS,
  HEALTH_TUNING,
  type HealthMetricSpec,
} from "./metrics";

const DAY_MS = 86_400_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

interface DayContext {
  /** Tiến độ trong cửa sổ: 0 = ngày cũ nhất, 1 = hôm nay. */
  progress: number;
  /** 0 = Chủ nhật .. 6 = Thứ bảy (UTC). */
  weekday: number;
  /** Gaussian 1σ đã seed — gọi đúng một lần mỗi ngày cho mỗi metric. */
  gaussian: () => number;
}

/**
 * Giá trị một ngày cho một metric. Công thức = baseline (tuning) + trôi tuyến tính theo
 * `progress` + nhiễu + nhịp tuần, rồi clamp vào khoảng hợp lý của simulator.
 * Hướng trôi: cơ/béo/HRV xấu dần, năng lượng/sức mạnh/nước/ngủ dao động quanh baseline.
 */
function valueFor(spec: HealthMetricSpec, baseline: number, ctx: DayContext): number {
  const { progress, weekday, gaussian } = ctx;
  const tuning = HEALTH_TUNING;
  const sessionDay = tuning.sessionWeekdays.includes(weekday);

  switch (spec.metric) {
    // Năng lượng tiêu hao: baseline ± nhịp tuần (ngày tập cao hơn, ngày nghỉ thấp hơn).
    case "calories_burned":
      return round(
        clamp(
          baseline + (sessionDay ? tuning.caloriesBurnedSessionBonus : tuning.caloriesBurnedRestDip) +
            gaussian() * tuning.noise.caloriesBurned,
          ...tuning.clamp.caloriesKcal,
        ),
        0,
      );
    case "calories_intake": {
      return round(clamp(baseline + gaussian() * tuning.noise.caloriesIntake, ...tuning.clamp.caloriesKcal), 0);
    }
    // Khối cơ: baseline theo crew, trôi −0.5% trên cửa sổ.
    case "muscle_mass":
      return round(
        clamp(
          baseline * (1 + tuning.drift.muscleMassPct * progress) + gaussian() * tuning.noise.muscleMass,
          ...tuning.clamp.muscleMassKg,
        ),
        2,
      );
    // Sức mạnh: trôi −1.5% trên cửa sổ (dưới "mission target" của simulator: 92 kgf).
    case "muscle_strength":
      return round(
        clamp(
          baseline * (1 + tuning.drift.muscleStrengthPct * progress) + gaussian() * tuning.noise.muscleStrength,
          ...tuning.clamp.muscleStrengthKgf,
        ),
        1,
      );
    case "body_fat":
      return round(
        clamp(baseline + tuning.drift.bodyFatPt * progress + gaussian() * tuning.noise.bodyFat, ...tuning.clamp.bodyFatPct),
        2,
      );
    case "sleep_duration":
      return round(clamp(baseline + gaussian() * tuning.noise.sleepDuration, ...tuning.clamp.sleepHours), 2);
    case "sleep_efficiency":
      return round(clamp(baseline + gaussian() * tuning.noise.sleepEfficiency, ...tuning.clamp.sleepEfficiencyPct), 1);
    // HRV: trôi giảm chậm (hướng vi trọng lực) + nhiễu ngày.
    case "hrv_ms":
      return round(
        clamp(baseline + tuning.drift.hrvMs * progress + gaussian() * tuning.noise.hrvMs, ...tuning.clamp.hrvMs),
        1,
      );
    case "water_intake":
      return round(clamp(baseline + gaussian() * tuning.noise.waterIntake, ...tuning.clamp.waterL), 2);
    // Liều tập: 26 min ngày Mon/Wed/Fri, 12 min ngày nghỉ.
    case "exercise_minutes":
      return round(
        clamp(
          (sessionDay ? tuning.exerciseMinutesSession : tuning.exerciseMinutesOff) +
            gaussian() * tuning.noise.exercise,
          ...tuning.clamp.exerciseMin,
        ),
        0,
      );
    case "heart_rate_bpm":
      return round(clamp(baseline + gaussian() * tuning.noise.heartRate, ...tuning.clamp.heartRateBpm), 0);
    // `energy_balance` là derived, không bao giờ đi qua đây.
    default:
      throw new Error(`health observation generator: unsupported metric ${spec.metric}`);
  }
}

/** Row của một metric cho một astronaut, dạng tăng dần theo ts. */
export function buildMetricRows(
  astronautId: string,
  spec: HealthMetricSpec,
  opts: { now?: Date; days?: number } = {},
): HealthObservationInsert[] {
  const days = opts.days ?? HEALTH_TUNING.windowDays;
  const now = opts.now ?? new Date();
  const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const baseline = baselineFor(spec.metric, astronautId);
  const gaussian = makeGaussian(mulberry32(seedFromString(`${astronautId}|${spec.metric}`)));
  const rows: HealthObservationInsert[] = [];

  for (let i = 0; i < days; i += 1) {
    const dayTs = todayUtcMidnight - (days - 1 - i) * DAY_MS;
    const date = new Date(dayTs);
    const progress = days <= 1 ? 1 : i / (days - 1);
    const value = valueFor(spec, baseline, { progress, weekday: date.getUTCDay(), gaussian });
    rows.push({
      ts: date.toISOString(),
      astronautId,
      metric: spec.metric,
      value,
      unit: spec.unit,
      source: "synthetic",
      method: spec.method,
      quality: "valid",
      confidence: spec.confidence,
    });
  }
  return rows;
}

/** Tất cả metric đã lưu cho một astronaut (11 series × `days` rows). */
export function buildHealthObservationRows(
  astronautId: string,
  opts: { now?: Date; days?: number } = {},
): HealthObservationInsert[] {
  return HEALTH_METRIC_SPECS.flatMap((spec) => buildMetricRows(astronautId, spec, opts));
}

export interface HealthSeedResult {
  /** Số row đã ghi. */
  inserted: number;
  /** Số cặp (astronaut, metric) đã có dữ liệu nên bỏ qua. */
  skipped: number;
}

/**
 * Seed lúc startup (server.ts, sau astronautsRepo.seed()). Chỉ ghi cặp (astronaut, metric)
 * đang rỗng, nên gọi lại nhiều lần là no-op. `astronautIds` để test chỉ định id giả.
 */
export async function seedHealthObservations(
  opts: { astronautIds?: string[]; now?: Date } = {},
): Promise<HealthSeedResult> {
  const astronautIds = opts.astronautIds ?? (await astronautsRepo.list()).map((row) => row.id);
  const now = opts.now ?? new Date();
  let inserted = 0;
  let skipped = 0;

  for (const astronautId of astronautIds) {
    for (const spec of HEALTH_METRIC_SPECS) {
      if (healthObservationsRepo.countByMetric(astronautId, spec.metric) > 0) {
        skipped += 1;
        continue;
      }
      const rows = buildMetricRows(astronautId, spec, { now });
      healthObservationsRepo.insertMany(rows);
      inserted += rows.length;
    }
  }

  return { inserted, skipped };
}
