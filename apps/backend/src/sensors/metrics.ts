// METRIC_SPECS — catalog metric simulator (SENSOR_SIMULATION_SPEC §5, §6.2).
// Mọi baseline/noise ở đây là ILLUSTRATIVE SIMULATOR TUNING — KHÔNG phải ngưỡng lâm sàng,
// không phải alarm threshold. Nguồn đối chiếu (không phải nguồn ngưỡng): SPEC §13, checked 2026-11-14.
//   HR/SpO₂/RR: humanresearchroadmap.nasa.gov/evidencereports · csa-asc.gc.ca/eng/sciences/bio-monitor.asp
//   Cabin O₂/CO₂/pressure: standards.nasa.gov (NASA-STD-3001 Vol 2) · sma.nasa.gov · visualization.osdr.nasa.gov/eda
//   Bức xạ: srag.jsc.nasa.gov · asc-csa.gc.ca/eng/iss/cans.asp · science.nasa.gov/biological-physical/data/osdr
//   Tim vi trọng lực: ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665

export interface MetricSpec {
  /** Metric id, khớp field trong payload (SPEC §4.4). */
  id: string;
  unit: string;
  /** Tần suất sim (Hz) hoặc "session" cho exercise — SPEC §5. */
  frequencyHz: number | "session";
  description: string;
  /** Illustrative simulator tuning — KHÔNG phải threshold lâm sàng. */
  baseline?: number;
  noiseSigma?: number;
  clampMin?: number;
  clampMax?: number;
  sourceUrl: string;
}

const HRP = "https://humanresearchroadmap.nasa.gov/evidencereports";
const CSA_BIOMONITOR = "https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp";
const STD3001 = "https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02";
const SMA = "https://sma.nasa.gov/";
const OSDR_EDA = "https://visualization.osdr.nasa.gov/eda/";
const SRAG = "https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm";
const CANS = "https://www.asc-csa.gc.ca/eng/iss/cans.asp";
const CIRC2026 = "https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665";
const NTRS = "https://ntrs.nasa.gov/";

export const METRIC_SPECS: MetricSpec[] = [
  // --- Wearable / personal ---
  // HR resting sim ~68 bpm — tuning, đối chiếu HRP Evidence Reports + CSA Bio-Monitor (SPEC §13).
  { id: "heart_rate_bpm", unit: "bpm", frequencyHz: 1, description: "Heart rate (resting sim baseline).", baseline: 68, noiseSigma: 3, clampMin: 45, clampMax: 180, sourceUrl: HRP },
  { id: "spo2_pct", unit: "%", frequencyHz: 1, description: "SpO₂ — pulse oximetry.", baseline: 98, noiseSigma: 0.3, clampMin: 88, clampMax: 100, sourceUrl: CSA_BIOMONITOR },
  { id: "respiratory_rate_bpm", unit: "bpm", frequencyHz: 1, description: "Respiratory rate.", baseline: 14, noiseSigma: 0.8, clampMin: 8, clampMax: 40, sourceUrl: HRP },
  // Skin/core temp — tuning; Bio-Monitor measures skin temp, T-Mini estimates core (ESA).
  { id: "skin_temperature_c", unit: "°C", frequencyHz: 0.2, description: "Skin temperature.", baseline: 33.5, noiseSigma: 0.1, clampMin: 30, clampMax: 37, sourceUrl: CSA_BIOMONITOR },
  { id: "core_temperature_c", unit: "°C", frequencyHz: 0.2, description: "Core temperature (estimated).", baseline: 37.0, noiseSigma: 0.05, clampMin: 35.5, clampMax: 38.5, sourceUrl: CSA_BIOMONITOR },
  // BP theo phiên bp-ecg — mỗi 60 s sim (SPEC §6.2).
  { id: "systolic_mmhg", unit: "mmHg", frequencyHz: 1 / 60, description: "Systolic BP, per bp-ecg session (every 60 s sim).", baseline: 118, noiseSigma: 4, clampMin: 70, clampMax: 220, sourceUrl: CIRC2026 },
  { id: "diastolic_mmhg", unit: "mmHg", frequencyHz: 1 / 60, description: "Diastolic BP, per bp-ecg session (every 60 s sim).", baseline: 76, noiseSigma: 3, clampMin: 40, clampMax: 130, sourceUrl: CIRC2026 },
  { id: "tidal_volume_ml", unit: "mL", frequencyHz: 1, description: "Tidal volume.", baseline: 500, noiseSigma: 40, clampMin: 200, clampMax: 2000, sourceUrl: HRP },
  { id: "minute_ventilation_l_min", unit: "L/min", frequencyHz: 1, description: "Minute ventilation (RR × tidal volume, derived).", baseline: 7.0, sourceUrl: HRP },
  { id: "activity_counts", unit: "counts", frequencyHz: 1, description: "Actigraphy activity counts (Poisson-ish).", baseline: 5, noiseSigma: 4, clampMin: 0, sourceUrl: CSA_BIOMONITOR },
  // --- Cabin environment (NASA-STD-3001 Vol 2 · SMA · OSDR EDA; tuning, không phải threshold) ---
  // co2_ppm: 850 ppm baseline sim; scenario co2_accumulation → ~2500 ppm = TARGET DEMO, thấp xa ngưỡng ISS.
  { id: "co2_ppm", unit: "ppm", frequencyHz: 1, description: "Cabin CO₂. 2500 ppm là target demo, KHÔNG phải alarm threshold (NASA-STD-3001 Vol 2).", baseline: 850, noiseSigma: 15, clampMin: 400, clampMax: 5000, sourceUrl: STD3001 },
  { id: "o2_pct", unit: "%", frequencyHz: 1, description: "Cabin O₂ fraction.", baseline: 20.9, noiseSigma: 0.05, clampMin: 19, clampMax: 23, sourceUrl: STD3001 },
  { id: "pressure_kpa", unit: "kPa", frequencyHz: 1, description: "Cabin pressure.", baseline: 101.3, noiseSigma: 0.1, clampMin: 70, clampMax: 110, sourceUrl: STD3001 },
  { id: "temperature_c", unit: "°C", frequencyHz: 1, description: "Cabin temperature.", baseline: 23.5, noiseSigma: 0.15, clampMin: 15, clampMax: 30, sourceUrl: STD3001 },
  { id: "humidity_pct", unit: "%", frequencyHz: 1, description: "Cabin relative humidity.", baseline: 40, noiseSigma: 0.8, clampMin: 20, clampMax: 80, sourceUrl: STD3001 },
  // --- Radiation (SRAG · CSA CANS · OSDR; tuning) ---
  { id: "dose_rate_uSv_h", unit: "µSv/h", frequencyHz: 1, description: "Personal dose rate (CAD). radiation_event: đỉnh 20–80, decay τ≈180 s.", baseline: 0.5, noiseSigma: 0.05, clampMin: 0, sourceUrl: SRAG },
  { id: "cumulative_equivalent_dose_mSv", unit: "mSv", frequencyHz: 1, description: "Cumulative equivalent dose — tích phân dose_rate.", baseline: 0, sourceUrl: SRAG },
  { id: "neutron_count", unit: "counts/60 s", frequencyHz: 1 / 60, description: "CANS neutron counts per 60 s integration window (simulated).", baseline: 12, noiseSigma: 4, clampMin: 0, sourceUrl: CANS },
  // --- Exercise (CEVIS; NTRS) ---
  { id: "power_w", unit: "W", frequencyHz: "session", description: "Ergometer power, chỉ trong session.", baseline: 140, noiseSigma: 8, clampMin: 0, sourceUrl: NTRS },
  { id: "cadence_rpm", unit: "rpm", frequencyHz: "session", description: "Ergometer cadence, chỉ trong session.", baseline: 85, noiseSigma: 3, clampMin: 0, sourceUrl: NTRS },
  // HR khi exercise → 142 ± 8, τ≈45 s sau khi session bắt đầu (tuning).
  { id: "exercise_heart_rate_bpm", unit: "bpm", frequencyHz: "session", description: "HR trong ergometer session (τ≈45 s).", baseline: 142, noiseSigma: 8, clampMin: 45, clampMax: 200, sourceUrl: NTRS },
];

export const metricById = new Map(METRIC_SPECS.map((m) => [m.id, m]));
