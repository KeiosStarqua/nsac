// Canonical Telemetry Envelope — zod (SENSOR_SIMULATION_SPEC §4).
// Mọi giá trị được simulator sinh là SYNTHETIC; `source.mode` luôn là synthetic khi simulator chạy (§1).
// Payload không chứa waveform/ảnh/binary — file lớn đi qua asset store, envelope chỉ mang asset_id (§4.4).

import { z } from "zod";

export const SourceModeSchema = z.enum(["synthetic", "replay", "real"]);
export type SourceMode = z.infer<typeof SourceModeSchema>;

export const QualityStatusSchema = z.enum(["good", "suspect", "invalid"]);
export type QualityStatus = z.infer<typeof QualityStatusSchema>;

export const QualitySchema = z.object({
  status: QualityStatusSchema,
  /** 0..1 — tuỳ chọn. */
  confidence: z.number().min(0).max(1).optional(),
});

const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "expected UTC ISO-8601 with ms (toISOString)");

export const TelemetryEventSchema = z.object({
  schema_version: z.literal("1.0"),
  event_id: z.string().uuid(),
  mission_id: z.string().trim().min(1).max(64),
  crew_id: z.string().trim().min(1).max(64).optional(),
  device_id: z.string().trim().min(1).max(64),
  device_type: z.string().trim().min(1).max(64),
  location_id: z.string().trim().min(1).max(64).optional(),
  source: z.object({
    mode: SourceModeSchema,
    dataset_id: z.string().max(128).optional(),
  }),
  observed_at: isoDateTime,
  received_at: isoDateTime,
  /** Per (mission_id, device_id), bắt đầu 1, tăng dần. */
  sequence: z.number().int().min(1),
  quality: QualitySchema,
  payload: z.unknown(),
});
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

// --- Payload schemas (SPEC §4.4) — số field mang đơn vị trong tên ---

// A. Wearable
export const BiomonitorPayloadSchema = z.object({
  heart_rate_bpm: z.number(),
  spo2_pct: z.number(),
  respiratory_rate_bpm: z.number(),
  skin_temperature_c: z.number(),
  activity_counts: z.number(),
});
export const EveryWearPayloadSchema = z.object({
  heart_rate_bpm: z.number(),
  activity_steps: z.number(),
  skin_temperature_c: z.number(),
  vascular_index: z.number().optional(),
});
export const ThermoMiniPayloadSchema = z.object({ core_temperature_c: z.number() });
export const BpEcgPayloadSchema = z.object({
  systolic_mmhg: z.number(),
  diastolic_mmhg: z.number(),
  heart_rate_bpm: z.number(),
});
export const UltrasoundMeasurementSchema = z.object({
  depth_cm: z.number(),
  frequency_mhz: z.number(),
  structure: z.string(),
  measurement_mm: z.number().optional(),
  asset_id: z.string().optional(),
});
export const PulseOximeterPayloadSchema = z.object({
  spo2_pct: z.number(),
  pulse_bpm: z.number(),
  /** 0..1 */
  signal_quality: z.number().min(0).max(1),
});
export const RespiratoryPayloadSchema = z.object({
  respiratory_rate_bpm: z.number(),
  tidal_volume_ml: z.number(),
  minute_ventilation_l_min: z.number().optional(),
});
export const UrineAnalyzerPayloadSchema = z.object({
  ph: z.number(),
  specific_gravity: z.number(),
  glucose_mg_dl: z.number().optional(),
  protein_mg_dl: z.number().optional(),
});
export const BloodAnalyzerPayloadSchema = z.object({
  hemoglobin_g_dl: z.number().optional(),
  hematocrit_pct: z.number().optional(),
  biomarkers: z.record(z.number()).optional(),
});
export const TempusPayloadSchema = z.object({
  heart_rate_bpm: z.number().optional(),
  systolic_mmhg: z.number().optional(),
  diastolic_mmhg: z.number().optional(),
  spo2_pct: z.number().optional(),
  etco2_mmhg: z.number().optional(),
  temperature_c: z.number().optional(),
  procedure: z.string().optional(),
  asset_id: z.string().optional(),
});
export const OctPayloadSchema = z.object({
  rnfl_thickness_um: z.number().optional(),
  intraocular_pressure_mmhg: z.number().optional(),
  asset_id: z.string().optional(),
});
export const DefibrillatorPayloadSchema = z.object({
  device_status: z.enum(["ready", "shock_delivered", "self_test", "fault"]),
  shock_energy_j: z.number().optional(),
  ecg_asset_id: z.string().optional(),
});

// C. Radiation
export const CadPayloadSchema = z.object({
  dose_rate_uSv_h: z.number(),
  cumulative_equivalent_dose_mSv: z.number(),
  session_id: z.string().optional(),
});
export const TepcPayloadSchema = z.object({
  absorbed_dose_rate_uGy_h: z.number(),
  spectrum: z.array(z.object({ energy_mev: z.number(), counts: z.number() })).optional(),
});
export const RamPayloadSchema = z.object({
  cumulative_dose_uSv: z.number(),
  location_id: z.string(),
});
export const CpdsPayloadSchema = z.object({
  particle_flux_cm2_s: z.number(),
  direction: z.enum(["x", "y", "z"]),
  energy_bins: z.array(z.object({ energy_mev: z.number(), counts: z.number() })).optional(),
});
export const PassiveDosimeterPayloadSchema = z.object({
  cumulative_dose_mSv: z.number(),
  read_at: z.string().optional(),
});
export const HeraRadRem2PayloadSchema = z.object({
  instrument: z.enum(["HERA", "RAD", "REM2"]),
  dose_rate_uGy_h: z.number().optional(),
  galactic_cosmic_ray_flux: z.number().optional(),
  solar_particle_event: z.boolean().optional(),
});

// D. Environment
export const O2AnalyzerPayloadSchema = z.object({
  o2_pct: z.number(),
  o2_partial_pressure_kpa: z.number().optional(),
});
export const Co2AnalyzerPayloadSchema = z.object({
  co2_ppm: z.number(),
  co2_mmhg: z.number().optional(),
});
export const PressurePayloadSchema = z.object({ pressure_kpa: z.number() });
export const TemperaturePayloadSchema = z.object({ temperature_c: z.number() });
export const HumidityPayloadSchema = z.object({ humidity_pct: z.number() });
export const CoMonitorPayloadSchema = z.object({ co_ppm: z.number() });
export const ToxicGasPayloadSchema = z.object({
  hcl_ppm: z.number().optional(),
  hcn_ppm: z.number().optional(),
});
export const VocPayloadSchema = z.object({
  voc_ppb: z.number().optional(),
  dominant_compounds: z.array(z.string()).optional(),
});
export const WaterQualityPayloadSchema = z.object({
  toc_mg_l: z.number().optional(),
  ph: z.number().optional(),
  conductivity_uS_cm: z.number().optional(),
});
export const MicrobialPayloadSchema = z.object({
  sample_id: z.string(),
  cfu_per_m3: z.number().optional(),
  analyzed_at: z.string().optional(),
});
export const SoundLevelPayloadSchema = z.object({
  spl_dba: z.number(),
  frequency_bands: z.record(z.number()).optional(),
});
export const AudioDosimeterPayloadSchema = z.object({
  noise_exposure_dba: z.number(),
  dose_pct: z.number(),
});
export const AirflowPayloadSchema = z.object({
  airflow_m_s: z.number(),
  fan_rpm: z.number().optional(),
});
export const ParticulatePayloadSchema = z.object({
  particulate_ug_m3: z.number(),
  size_bins_um: z.record(z.number()).optional(),
});

// E. Exercise
export const TreadmillPayloadSchema = z.object({
  speed_kmh: z.number(),
  duration_s: z.number(),
  heart_rate_bpm: z.number().optional(),
  harness_load_kg: z.number().optional(),
});
export const ErgometerPayloadSchema = z.object({
  power_w: z.number(),
  cadence_rpm: z.number(),
  session_id: z.string(),
  elapsed_s: z.number(),
  heart_rate_bpm: z.number().optional(),
});
export const AredPayloadSchema = z.object({
  exercise_type: z.string(),
  resistance_kg: z.number(),
  sets: z.number().int(),
  repetitions: z.number().int(),
});
export const SleepMonitorPayloadSchema = z.object({
  activity_counts: z.number(),
  sleep_period_min: z.number().optional(),
  sleep_efficiency_pct: z.number().optional(),
});
export const BodyMassPayloadSchema = z.object({ body_mass_kg: z.number() });

// F. Next-gen — giá trị/bin do Sky định nghĩa, KHÔNG phải giao thức CANS thật.
export const CansPayloadSchema = z.object({
  device_id: z.literal("CANS-01"),
  neutron_count: z.number().int().min(0),
  integration_seconds: z.number().int().min(1),
  dose_rate_uSv_h: z.number(),
  energy_spectrum: z.array(z.object({ energy_mev: z.number(), counts: z.number() })),
  quality: z.literal("simulated"),
});

/** Payload schema cho 13 device_id mà simulator sinh (12 streams — SPEC §4.3/§6). */
export const SIMULATED_PAYLOAD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  biomonitor: BiomonitorPayloadSchema,
  "thermo-mini": ThermoMiniPayloadSchema,
  "bp-ecg": BpEcgPayloadSchema,
  "pulse-oximeter": PulseOximeterPayloadSchema,
  "respiratory-assessment": RespiratoryPayloadSchema,
  "o2-analyzer": O2AnalyzerPayloadSchema,
  "co2-analyzer": Co2AnalyzerPayloadSchema,
  "pressure-sensor": PressurePayloadSchema,
  "temperature-sensor": TemperaturePayloadSchema,
  "humidity-sensor": HumidityPayloadSchema,
  cad: CadPayloadSchema,
  ergometer: ErgometerPayloadSchema,
  cans: CansPayloadSchema,
};
