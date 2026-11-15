// Health observation layer — catalog metric fitness/smartwatch + tuning của simulator.
//
// TOÀN BỘ số ở đây là SIMULATOR TUNING cho dữ liệu synthetic, KHÔNG phải ngưỡng lâm sàng,
// không phải baseline y khoa của cá nhân nào. Không alert, không chẩn đoán: layer này chỉ ghi
// dữ liệu để UI/agent diễn giải; mọi hành động vẫn cần phi hành gia xác nhận (HKT hard rule).
//
// Nguồn tham chiếu cho từng họ số (mỗi mục có URL riêng bên dưới):
//   - Cơ/xương, khối cơ, body fat, sức mạnh, liều tập: NASA HRP Evidence Report Musculoskeletal
//     https://humanresearchroadmap.nasa.gov/evidence-reports/human-health-risks-of-space-exploration-for-mission-design/musculoskeletal/
//   - Tim mạch / HRV / LV-stroke volume (hướng suy giảm khi ở vi trọng lực):
//     https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665
//   - Giấc ngủ trên quỹ đạo (actigraphy):
//     https://humanresearchroadmap.nasa.gov/evidence-reports/human-health-risks-of-space-exploration-for-mission-design/sleep/
//   - Năng lượng/nước ăn vào, thiết kế môi trường sống (không recreate ngưỡng y tế):
//     https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02
//   - Tự báo cáo + wearable (EveryWear / Bio-Monitor):
//     https://www.esa.int/ · https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp

export const OBSERVATION_METHODS = ["sensor", "measured", "estimated", "self_reported", "simulated"] as const;
export type ObservationMethod = (typeof OBSERVATION_METHODS)[number];

export const OBSERVATION_QUALITIES = ["valid", "suspect", "invalid"] as const;
export type ObservationQuality = (typeof OBSERVATION_QUALITIES)[number];

/** 11 metric được lưu. `energy_balance` là derived (intake − burned), KHÔNG lưu. */
export const HEALTH_METRIC_IDS = [
  "calories_burned",
  "calories_intake",
  "muscle_mass",
  "muscle_strength",
  "body_fat",
  "sleep_duration",
  "sleep_efficiency",
  "hrv_ms",
  "water_intake",
  "exercise_minutes",
  "heart_rate_bpm",
] as const;
export type HealthMetricId = (typeof HEALTH_METRIC_IDS)[number];

const HRP_MUSCULOSKELETAL =
  "https://humanresearchroadmap.nasa.gov/evidence-reports/human-health-risks-of-space-exploration-for-mission-design/musculoskeletal/";
const HRP_SLEEP =
  "https://humanresearchroadmap.nasa.gov/evidence-reports/human-health-risks-of-space-exploration-for-mission-design/sleep/";
const CIRC_2026_ISS_LV =
  "https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665";
const NASA_STD_3001_V2 = "https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02";
const ESA_EVERYWEAR = "https://www.esa.int/";
const CSA_BIOMONITOR = "https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp";

export const HEALTH_SOURCES = {
  musculoskeletal: HRP_MUSCULOSKELETAL,
  sleep: HRP_SLEEP,
  cardio: CIRC_2026_ISS_LV,
  standards: NASA_STD_3001_V2,
  everywear: ESA_EVERYWEAR,
  bioMonitor: CSA_BIOMONITOR,
} as const;

export interface HealthMetricSpec {
  metric: HealthMetricId;
  unit: string;
  /** Độ tin của phép đo giả lập — quyết định cột method, không phải "độ chính xác lâm sàng". */
  method: ObservationMethod;
  /** Simulator tuning baseline — KHÔNG phải clinical guidance. */
  baseline: number;
  /** Confidence 0..1 ghi kèm mỗi row (hằng theo method). */
  confidence: number;
  sourceUrl: string;
  description: string;
}

export const HEALTH_METRIC_SPECS: HealthMetricSpec[] = [
  // ~2380 kcal/ngày ở mức hoạt động ISS; dao động theo ngày tập/ngày nghỉ (tuning, không phải
  // khuyến nghị dinh dưỡng). Đối chiếu bối cảnh năng lượng: NASA-STD-3001 Vol 2.
  {
    metric: "calories_burned",
    unit: "kcal",
    method: "estimated",
    baseline: 2380,
    confidence: 0.8,
    sourceUrl: NASA_STD_3001_V2,
    description: "Năng lượng tiêu hao ước tính/ngày (wearable estimate).",
  },
  // ~2450 kcal/ngày ăn vào — nhập tay, sai số lớn; tuning theo bối cảnh năng lượng NASA-STD-3001.
  {
    metric: "calories_intake",
    unit: "kcal",
    method: "self_reported",
    baseline: 2450,
    confidence: 0.7,
    sourceUrl: NASA_STD_3001_V2,
    description: "Năng lượng ăn vào tự báo cáo/ngày.",
  },
  // 61.4 kg khối cơ là baseline tuning cho crew trung bình, scale theo từng người bằng hệ số
  // hằng (Lena ~47.2 kg, Yuki ~63 kg). Trôi −0.5% trong cửa sổ 35 ngày mô phỏng atrophy
  // được báo cáo trong HRP Musculoskeletal; KHÔNG dùng để kết luận y khoa.
  {
    metric: "muscle_mass",
    unit: "kg",
    method: "estimated",
    baseline: 61.4,
    confidence: 0.8,
    sourceUrl: HRP_MUSCULOSKELETAL,
    description: "Khối cơ ước tính (DXA cadence thật thưa hơn — xem seed.ts).",
  },
  // 88 kgf baseline tuning, trôi −1.5% trong 35 ngày — dưới "mission target" của chính
  // simulator (xem seed.ts), không phải ngưỡng lâm sàng. HRP Musculoskeletal.
  {
    metric: "muscle_strength",
    unit: "kgf",
    method: "measured",
    baseline: 88,
    confidence: 0.95,
    sourceUrl: HRP_MUSCULOSKELETAL,
    description: "Sức mạnh cơ đo theo phiên (grip/leg press sim).",
  },
  // 17.8% baseline tuning, trôi +0.3 điểm phần trăm trong 35 ngày (mất cơ, giữ mỡ).
  {
    metric: "body_fat",
    unit: "%",
    method: "estimated",
    baseline: 17.8,
    confidence: 0.75,
    sourceUrl: HRP_MUSCULOSKELETAL,
    description: "Tỷ lệ mỡ cơ thể ước tính.",
  },
  // 7.35 h baseline tuning; HRP Sleep (actigraphy) cho thấy giấc ngủ trên quỹ đạo ngắn và
  // phân mảnh hơn ở mặt đất — đây chỉ là mức mô phỏng, không phải khuyến nghị.
  {
    metric: "sleep_duration",
    unit: "h",
    method: "measured",
    baseline: 7.35,
    confidence: 0.9,
    sourceUrl: HRP_SLEEP,
    description: "Tổng thời gian ngủ/ngày (actigraphy).",
  },
  // 88% baseline tuning (tỷ lệ thời gian ngủ trên thời gian trên giường).
  {
    metric: "sleep_efficiency",
    unit: "%",
    method: "measured",
    baseline: 88,
    confidence: 0.85,
    sourceUrl: HRP_SLEEP,
    description: "Hiệu suất giấc ngủ (actigraphy).",
  },
  // 61 ms baseline tuning với trôi giảm chậm — hướng suy giảm HRV khi ở vi trọng lực theo
  // Circulation 2026 (ISS LV/stroke volume); công thức minh họa, không phải ngưỡng.
  {
    metric: "hrv_ms",
    unit: "ms",
    method: "estimated",
    baseline: 61,
    confidence: 0.8,
    sourceUrl: CIRC_2026_ISS_LV,
    description: "HRV (RMSSD-like) ước tính từ nhịp tim.",
  },
  // 2.3 L/ngày tự báo cáo — bối cảnh nước uống theo NASA-STD-3001 Vol 2, không phải chỉ định.
  {
    metric: "water_intake",
    unit: "L",
    method: "self_reported",
    baseline: 2.3,
    confidence: 0.7,
    sourceUrl: NASA_STD_3001_V2,
    description: "Nước uống vào tự báo cáo/ngày.",
  },
  // 12 min ngày nghỉ / 26 min ngày có phiên (3 phiên/tuần: Mon/Wed/Fri) — liều tập mô phỏng
  // theo khung countermeasure của HRP Musculoskeletal + log hoạt động wearable (ESA EveryWear),
  // không phải protocol y khoa.
  {
    metric: "exercise_minutes",
    unit: "min",
    method: "measured",
    baseline: 12,
    confidence: 0.95,
    sourceUrl: HRP_MUSCULOSKELETAL,
    description: "Phút vận động ghi nhận (ngày nghỉ 12/min, ngày tập 26/min).",
  },
  // 68 bpm baseline nghỉ — cùng baseline với catalog sensors (metrics.ts bên sensors/) và
  // wearable Bio-Monitor/EveryWear làm bối cảnh thiết bị.
  {
    metric: "heart_rate_bpm",
    unit: "bpm",
    method: "sensor",
    baseline: 68,
    confidence: 0.98,
    sourceUrl: CSA_BIOMONITOR,
    description: "Nhịp tim nghỉ/ngày (wearable sensor).",
  },
];

export const healthMetricById = new Map(HEALTH_METRIC_SPECS.map((spec) => [spec.metric, spec]));

// Khối cơ baseline khác nhau theo cơ thể từng crew (fictional ids). Hệ số hằng quanh 61.4 kg;
// giá trị chỉ để hình dung, không suy ra từ dữ liệu cá nhân nào.
const CREW_MUSCLE_MASS_FACTOR: Record<string, number> = {
  "ayla-reyes": 1.0, // 61.4 kg
  "dae-jung-park": 0.9625, // ~59.1 kg
  "lena-fischer": 0.7687, // ~47.2 kg
  "tomas-ortega": 1.0195, // ~62.6 kg
  "yuki-tanaka": 1.0261, // ~63.0 kg
  "noor-abbasi": 0.9023, // ~55.4 kg
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Baseline tuning cho một metric; riêng muscle_mass scale theo crew (hằng số). */
export function baselineFor(metric: HealthMetricId, astronautId: string): number {
  const spec = healthMetricById.get(metric);
  const base = spec?.baseline ?? 0;
  if (metric !== "muscle_mass") return base;
  const factor = CREW_MUSCLE_MASS_FACTOR[astronautId] ?? 1;
  return round1(base * factor);
}

// ---------------------------------------------------------------------------
// Tuning số của generator (seed.ts đọc từ đây để mọi con số + nguồn nằm một chỗ).
// `noise` là sigma (1σ); biên độ ± trong brief xấp xỉ 2σ. Mọi mục là simulator tuning.
// ---------------------------------------------------------------------------
export const HEALTH_TUNING = {
  /** Cửa sổ seed: 35 ngày gần nhất, mỗi ngày một row/metric. */
  windowDays: 35,
  /** Trôi trên toàn cửa sổ (không phải tốc độ/ngày). */
  drift: {
    muscleMassPct: -0.005, // −0.5% / 35 ngày — HRP Musculoskeletal
    muscleStrengthPct: -0.015, // −1.5% / 35 ngày — HRP Musculoskeletal
    bodyFatPt: 0.3, // +0.3 điểm % / 35 ngày — HRP Musculoskeletal
    hrvMs: -6, // −6 ms / 35 ngày — Circulation 2026 (hướng suy giảm)
  },
  noise: {
    caloriesBurned: 60,
    caloriesIntake: 75,
    muscleMass: 0.08,
    muscleStrength: 1.2,
    bodyFat: 0.15,
    sleepDuration: 0.2,
    sleepEfficiency: 1.25,
    hrvMs: 3,
    waterIntake: 0.15,
    exercise: 3,
    heartRate: 3,
  },
  /** Liều tập: phiên vào Mon/Wed/Fri (0=CN..6=T7), còn lại là ngày nghỉ. */
  sessionWeekdays: [1, 3, 5] as number[],
  exerciseMinutesSession: 26,
  exerciseMinutesOff: 12,
  /** Ngày tập tiêu hao thêm, ngày nghỉ giảm nhẹ (kcal/ngày) — tuning. */
  caloriesBurnedSessionBonus: 120,
  caloriesBurnedRestDip: -90,
  /** Biên sanity của simulator — KHÔNG phải ngưỡng lâm sàng, không dùng để alert. */
  clamp: {
    caloriesKcal: [1200, 4200],
    muscleMassKg: [25, 110],
    muscleStrengthKgf: [15, 200],
    bodyFatPct: [4, 45],
    sleepHours: [4.2, 10],
    sleepEfficiencyPct: [60, 100],
    hrvMs: [15, 150],
    waterL: [0.8, 4.5],
    exerciseMin: [0, 120],
    heartRateBpm: [42, 110],
  },
} as const;
