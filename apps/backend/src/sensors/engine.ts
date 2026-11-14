// SimulationEngine — deterministic-first simulator cho 12 stream §6 (SENSOR_SIMULATION_SPEC).
// PRNG seeded (mulberry32), mọi baseline là ILLUSTRATIVE SIMULATOR TUNING — không phải ngưỡng lâm sàng.
// Nguồn tham chiếu (không phải threshold): SPEC §13 — check 2026-11-14.
//   HRP Evidence Reports (HR/SpO₂/RR): https://humanresearchroadmap.nasa.gov/evidencereports
//   NASA-STD-3001 Vol 2 (cabin): https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02
//   SRAG + CSA CANS (radiation): https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm · https://www.asc-csa.gc.ca/eng/iss/cans.asp
//
// Determinism: cùng seed + cùng scenario ⇒ cùng chuỗi events (event_id là uuid ngẫu nhiên — ngoại lệ duy nhất).
// received_at lấy từ sim clock nên cũng deterministic; engine tests truyền startTimeMs cố định.

import EventEmitter3 from "eventemitter3";
import { SIMULATED_PAYLOAD_SCHEMAS, TelemetryEventSchema, type TelemetryEvent, type QualityStatus } from "./envelope";
import { mulberry32, seedFromString, makeGaussian } from "./prng";
import { DEVICES, deviceById, deviceTypeOf } from "./registry";
import { sensorsStore, type TelemetryStore } from "./store";

export const SCENARIOS = [
  "normal",
  "exercise",
  "co2_accumulation",
  "radiation_event",
  "sensor_fault",
  "anomaly_symptom",
  "comm_loss",
] as const;
export type Scenario = (typeof SCENARIOS)[number];

export interface FaultConfig {
  deviceId: string;
  kind: "dropout" | "stuck" | "drift";
  /** dropout probability per event, mặc định 0.3 (SPEC §6.3). */
  p?: number;
  /** drift offset tuyến tính (đơn vị/phút), mặc định 0.5. */
  driftPerMin?: number;
  stuckValue?: number;
}

export interface SimStartOptions {
  scenario?: Scenario;
  speed?: 1 | 10 | 100;
  missionId?: string;
  crewId?: string;
  seed?: string;
  fault?: FaultConfig;
  /** true → không setInterval, tests tự drive tick(). */
  manual?: boolean;
  /** Sim clock origin (ms epoch). Mặc định Date.now(); tests truyền cố định. */
  startTimeMs?: number;
}

export interface SimStatus {
  running: boolean;
  scenario: Scenario;
  speed: 1 | 10 | 100;
  missionId: string;
  /** Bộ đếm sequence in-memory per device_id (khởi tạo từ MAX(sequence) trong DB khi start). */
  sequence: Record<string, number>;
  startedAt: string | null;
  simulated: true;
}

const DEFAULT_SEED = "sky-sim-1";
const DEFAULT_MISSION_ID = "SIM-001";
// Crew ids hư cấu — giống apps/backend astronautsRepo; không phải phi hành gia thật (SPEC §1).
export const DEFAULT_CREW_IDS = [
  "ayla-reyes",
  "dae-jung-park",
  "lena-fischer",
  "tomas-ortega",
  "yuki-tanaka",
  "noor-abbasi",
] as const;
const EXERCISE_SECONDS = 480; // ergometer session 8' sim (SPEC §6.3)
const SIMULATED_DEVICE_IDS = [
  "biomonitor",
  "thermo-mini",
  "bp-ecg",
  "pulse-oximeter",
  "respiratory-assessment",
  "o2-analyzer",
  "co2-analyzer",
  "pressure-sensor",
  "temperature-sensor",
  "humidity-sensor",
  "cad",
  "ergometer",
  "cans",
] as const;

/** In-process notifier riêng cho telemetry — KHÔNG tái dùng change_events (SPEC §6.4, §11). */
export const telemetryBus = new EventEmitter3();

// --- Baselines: illustrative simulator tuning (SPEC §6.2, không phải threshold lâm sàng) ---
const HR_BASELINE = 68; // tuning; HRP Evidence Reports + CSA Bio-Monitor (SPEC §13)
const HR_NOISE = 3; // σ — §6.2
const HR_EXERCISE = 142; // ±8, τ≈45 s khi exercise — §6.2/§6.3
const HR_EXERCISE_NOISE = 8;
const SPO2_BASELINE = 98; // §6.2
const SPO2_NOISE = 0.3;
const RR_BASELINE = 14; // §6.2
const RR_NOISE = 0.8;
const SKIN_TEMP_BASELINE = 33.5; // §6.2
const SKIN_TEMP_NOISE = 0.1;
const CORE_TEMP_BASELINE = 37.0; // §6.2
const CORE_TEMP_NOISE = 0.05;
const SBP_BASELINE = 118; // §6.2 (Circulation 2026 — LV volume/pressure ISS)
const SBP_NOISE = 4;
const DBP_BASELINE = 76; // §6.2
const DBP_NOISE = 3;
const TIDAL_BASELINE = 500; // §6.2
const TIDAL_NOISE = 40;
const CO2_BASELINE = 850; // ppm baseline sim — §6.2
const CO2_TARGET = 2500; // ppm — TARGET DEMO cho co2_accumulation, thấp xa ngưỡng ISS; KHÔNG phải alarm threshold (NASA-STD-3001 Vol 2)
const CO2_NOISE = 15;
const CO2_TAU_S = 120;
const CO2_RR_BOOST = 4; // RR +4 khi co2_accumulation (τ≈60 s) — §6.3
const CO2_HR_BOOST = 6; // HR +6 — §6.3
const O2_BASELINE = 20.9; // % — §6.2
const O2_NOISE = 0.05;
const PRESSURE_BASELINE = 101.3; // kPa — §6.2
const PRESSURE_NOISE = 0.1;
const CABIN_TEMP_BASELINE = 23.5; // §6.2
const CABIN_TEMP_NOISE = 0.15;
const HUMIDITY_BASELINE = 40; // §6.2
const HUMIDITY_NOISE = 0.8;
const ACTIVITY_BASELINE = 5; // Poisson-ish — §6.2
const ACTIVITY_NOISE = 4;
const CAD_DOSE_RATE_BASELINE = 0.5; // µSv/h — §6.2; SRAG
const CAD_DOSE_NOISE = 0.05;
const RAD_DECAY_TAU_S = 180; // τ≈180 s — §6.2/§6.3
const CO2_RESPONSE_TAU_S = 60;
const ANOMALY_TAU_S = 300; // onset chậm — §6.3
const ANOMALY_HR_DELTA = 12;
const ANOMALY_SPO2_DELTA = -1.5;
const ANOMALY_RR_DELTA = 2;
const CANS_BASELINE_COUNTS = 12; // per 60 s window — §6.2; CANS tuning
const CANS_NOISE = 4;
const EXERCISE_POWER = 140; // CEVIS session fixture — §6.2 (NTRS)
const EXERCISE_POWER_NOISE = 8;
const EXERCISE_CADENCE = 85; // §6.2
const EXERCISE_CADENCE_NOISE = 3;
const EXERCISE_TAU_S = 45;

/** Payload keys không bị drift fault cộng offset — integrators/counters/session markers. */
const DRIFT_SKIP_KEYS = new Set([
  "activity_counts",
  "elapsed_s",
  "integration_seconds",
  "neutron_count",
  "cumulative_equivalent_dose_mSv",
]);

/** Field "chính" mỗi device — nơi fault.stuckValue ghi đè (SPEC §6.3). */
const PRIMARY_FIELD: Record<string, string> = {
  biomonitor: "heart_rate_bpm",
  "thermo-mini": "core_temperature_c",
  "bp-ecg": "systolic_mmhg",
  "pulse-oximeter": "spo2_pct",
  "respiratory-assessment": "respiratory_rate_bpm",
  "o2-analyzer": "o2_pct",
  "co2-analyzer": "co2_ppm",
  "pressure-sensor": "pressure_kpa",
  "temperature-sensor": "temperature_c",
  "humidity-sensor": "humidity_pct",
  cad: "dose_rate_uSv_h",
  ergometer: "power_w",
  cans: "neutron_count",
};

interface CrewState {
  /** Cá nhân hoá nhẹ — phase/amplitude ổn định trong session (SPEC §6.1). */
  phase: number;
  amplitude: number;
  hr: number;
  spo2: number;
  rr: number;
  tidal: number;
  skinTemp: number;
  coreTemp: number;
  sbp: number;
  dbp: number;
}

interface MissionState {
  o2: number;
  co2: number;
  pressure: number;
  cabinTemp: number;
  humidity: number;
  cadCumulative: number;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Mean-reverting walk một bước (dt=1 s): x += (target−x)·(1−e^(−dt/τ)) + ε, std dừng ≈ noiseSigma. */
function walkStep(value: number, target: number, tauSeconds: number, noiseSigma: number, gauss: () => number): number {
  const k = 1 - Math.exp(-1 / tauSeconds);
  // Scale innovation để stationary std xấp xỉ noiseSigma (không phụ thuộc τ) — đường đi mượt, không nhảy số.
  const sigma = noiseSigma * Math.sqrt(2 * k - k * k);
  return value + (target - value) * k + gauss() * sigma;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface SimulationEngineDeps {
  store?: TelemetryStore;
}

export class SimulationEngine {
  private store: TelemetryStore;
  private timer: ReturnType<typeof setInterval> | null = null;

  private running = false;
  private scenario: Scenario = "normal";
  private speed: 1 | 10 | 100 = 1;
  private missionId = DEFAULT_MISSION_ID;
  private seed = DEFAULT_SEED;
  private fault: FaultConfig | null = null;
  private crewIds: string[] = [...DEFAULT_CREW_IDS];
  private exerciseCrewId = "ayla-reyes"; // target khi scenario=exercise (hoặc crewId truyền vào)
  private anomalyCrewId = "ayla-reyes"; // target khi scenario=anomaly_symptom

  private simTimeMs = 0;
  private startedAtMs: number | null = null;
  private tickIndex = 0; // số tick đã chạy (0-based)
  private sequences = new Map<string, number>();
  private stuckPayloads = new Map<string, Record<string, unknown>>(); // frozen payload khi kind=stuck

  private rng: () => number = mulberry32(seedFromString(DEFAULT_SEED));
  private gauss: () => number = makeGaussian(this.rng);
  private crew = new Map<string, CrewState>();
  private mission: MissionState = {
    o2: O2_BASELINE,
    co2: CO2_BASELINE,
    pressure: PRESSURE_BASELINE,
    cabinTemp: CABIN_TEMP_BASELINE,
    humidity: HUMIDITY_BASELINE,
    cadCumulative: 0,
  };
  private radiationPeakUSvH = 40; // chỉ dùng khi scenario=radiation_event; draw từ seed lúc start
  private cansMultiplier = 8; // ×6–12 (SPEC §6.3); draw từ seed lúc start

  constructor(deps: SimulationEngineDeps = {}) {
    this.store = deps.store ?? sensorsStore;
  }

  status(): SimStatus {
    const sequence: Record<string, number> = {};
    for (const [k, v] of this.sequences) sequence[k] = v;
    return {
      running: this.running,
      scenario: this.scenario,
      speed: this.speed,
      missionId: this.missionId,
      sequence,
      startedAt: this.startedAtMs === null ? null : iso(this.startedAtMs),
      simulated: true,
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  start(opts: SimStartOptions = {}): SimStatus {
    if (this.running) throw new Error("already_running");
    this.scenario = opts.scenario ?? "normal";
    this.speed = opts.speed ?? 1;
    this.missionId = opts.missionId ?? DEFAULT_MISSION_ID;
    this.seed = opts.seed ?? DEFAULT_SEED;
    this.fault = this.scenario === "sensor_fault" ? (opts.fault ?? null) : null;

    const crewId = opts.crewId?.trim();
    this.crewIds = crewId ? [crewId] : [...DEFAULT_CREW_IDS];
    this.exerciseCrewId = crewId ?? "ayla-reyes";
    this.anomalyCrewId = crewId ?? "ayla-reyes";

    this.rng = mulberry32(seedFromString(this.seed));
    this.gauss = makeGaussian(this.rng);

    this.crew = new Map();
    for (const id of this.crewIds) {
      this.crew.set(id, {
        phase: this.rng() * 2 * Math.PI,
        amplitude: 0.9 + this.rng() * 0.2,
        hr: HR_BASELINE,
        spo2: SPO2_BASELINE,
        rr: RR_BASELINE,
        tidal: TIDAL_BASELINE,
        skinTemp: SKIN_TEMP_BASELINE,
        coreTemp: CORE_TEMP_BASELINE,
        sbp: SBP_BASELINE,
        dbp: DBP_BASELINE,
      });
    }
    this.mission = {
      o2: O2_BASELINE,
      co2: CO2_BASELINE,
      pressure: PRESSURE_BASELINE,
      cabinTemp: CABIN_TEMP_BASELINE,
      humidity: HUMIDITY_BASELINE,
      cadCumulative: 0,
    };
    // Draw scenario params theo thứ tự cố định — giữ determinism.
    this.radiationPeakUSvH = 20 + this.rng() * 60; // 20–80 (SPEC §6.2)
    this.cansMultiplier = 6 + this.rng() * 6; // ×6–12 (SPEC §6.3)

    // Sequence không reset về 1 khi restart — đọc MAX(sequence) từ DB (SPEC §6.4); in-memory counter sau start.
    this.sequences = new Map();
    for (const id of SIMULATED_DEVICE_IDS) {
      let base = 0;
      try {
        base = this.store.maxSequence(this.missionId, id);
      } catch {
        base = 0;
      }
      this.sequences.set(id, Number.isFinite(base) ? base : 0);
    }
    this.stuckPayloads = new Map();

    this.startedAtMs = opts.startTimeMs ?? Date.now();
    this.simTimeMs = this.startedAtMs;
    this.tickIndex = 0;
    this.running = true;

    if (!opts.manual) {
      this.timer = setInterval(() => {
        this.tick();
      }, 1000 / this.speed);
    }
    return this.status();
  }

  stop(): SimStatus {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    const status = this.status();
    // SPEC §8.2: khi stop → server broadcast sim_state cuối. ws.ts lắng nghe bus này.
    telemetryBus.emit("sim_state", status);
    return status;
  }

  /** Stop + xoá toàn bộ events của mission hiện tại (demo helper, SPEC §8.1). */
  reset(): { ok: true; deleted: number } {
    this.stop();
    const deleted = this.store.deleteByMission(this.missionId);
    this.sequences = new Map();
    this.startedAtMs = null;
    return { ok: true, deleted };
  }

  /** Một bước sim = 1000 ms sim-time (SPEC §6.4). */
  tick(): TelemetryEvent[] {
    if (!this.running) return [];
    const events: TelemetryEvent[] = [];
    const t = this.tickIndex; // giây đã trôi qua kể từ start
    const simMinutes = t / 60;

    const co2Factor = this.scenario === "co2_accumulation" ? 1 - Math.exp(-t / CO2_TAU_S) : 0;
    const co2Target = CO2_BASELINE + (CO2_TARGET - CO2_BASELINE) * co2Factor;
    const co2Env = this.scenario === "co2_accumulation" ? 1 - Math.exp(-t / CO2_RESPONSE_TAU_S) : 0;
    const anomalyEnv = this.scenario === "anomaly_symptom" ? 1 - Math.exp(-t / ANOMALY_TAU_S) : 0;
    const radiationEnv = this.scenario === "radiation_event" ? Math.exp(-t / RAD_DECAY_TAU_S) : 0;
    const exerciseActive = this.scenario === "exercise" && t < EXERCISE_SECONDS;

    // --- Walk mission-scoped metrics ---
    this.mission.co2 = clamp(walkStep(this.mission.co2, co2Target, CO2_TAU_S, CO2_NOISE, this.gauss), 400, 5000);
    this.mission.o2 = clamp(walkStep(this.mission.o2, O2_BASELINE, 300, O2_NOISE, this.gauss), 19, 23);
    this.mission.pressure = clamp(walkStep(this.mission.pressure, PRESSURE_BASELINE, 600, PRESSURE_NOISE, this.gauss), 70, 110);
    this.mission.cabinTemp = clamp(walkStep(this.mission.cabinTemp, CABIN_TEMP_BASELINE, 600, CABIN_TEMP_NOISE, this.gauss), 15, 30);
    this.mission.humidity = clamp(walkStep(this.mission.humidity, HUMIDITY_BASELINE, 600, HUMIDITY_NOISE, this.gauss), 20, 80);

    // Dose rate envelope: 0.5 µSv/h baseline; bức xạ spike 20–80 decay τ≈180 s (SPEC §6.2, SRAG).
    const doseEnvelope =
      this.scenario === "radiation_event" ? CAD_DOSE_RATE_BASELINE + (this.radiationPeakUSvH - CAD_DOSE_RATE_BASELINE) * radiationEnv : CAD_DOSE_RATE_BASELINE;
    const doseRate = Math.max(0, doseEnvelope + this.gauss() * CAD_DOSE_NOISE);
    this.mission.cadCumulative += doseRate / 3600 / 1000; // µSv/h × 1 s → mSv

    // --- Walk per-crew metrics ---
    for (const [crewId, c] of this.crew) {
      const isAnomaly = this.scenario === "anomaly_symptom" && crewId === this.anomalyCrewId;
      const isExercise = exerciseActive && crewId === this.exerciseCrewId;
      const phaseOffset = 2 * Math.sin(c.phase + t / 900); // cá nhân hoá rất nhẹ

      // Target di chuyển chậm theo envelope τ của scenario (SPEC §6.3); walk τ ngắn để bám target + nhiễu.
      const hrTarget = isExercise
        ? HR_EXERCISE
        : HR_BASELINE + CO2_HR_BOOST * co2Env + (isAnomaly ? ANOMALY_HR_DELTA * anomalyEnv : 0) + phaseOffset;
      const rrTarget = RR_BASELINE + CO2_RR_BOOST * co2Env + (isAnomaly ? ANOMALY_RR_DELTA * anomalyEnv : 0);
      const spo2Target = SPO2_BASELINE + (isAnomaly ? ANOMALY_SPO2_DELTA * anomalyEnv : 0);

      c.hr = clamp(
        walkStep(c.hr, hrTarget, isExercise ? EXERCISE_TAU_S : CO2_RESPONSE_TAU_S, isExercise ? HR_EXERCISE_NOISE * c.amplitude : HR_NOISE * c.amplitude, this.gauss),
        45,
        180,
      );
      c.rr = clamp(walkStep(c.rr, rrTarget, CO2_RESPONSE_TAU_S, RR_NOISE * c.amplitude, this.gauss), 8, 40);
      c.spo2 = clamp(walkStep(c.spo2, spo2Target, ANOMALY_TAU_S, SPO2_NOISE * c.amplitude, this.gauss), 88, 100);
      c.tidal = clamp(walkStep(c.tidal, TIDAL_BASELINE, 120, TIDAL_NOISE * c.amplitude, this.gauss), 200, 2000);
      c.skinTemp = clamp(walkStep(c.skinTemp, SKIN_TEMP_BASELINE, 300, SKIN_TEMP_NOISE * c.amplitude, this.gauss), 30, 37);
      c.coreTemp = clamp(walkStep(c.coreTemp, CORE_TEMP_BASELINE, 300, CORE_TEMP_NOISE * c.amplitude, this.gauss), 35.5, 38.5);
      c.sbp = clamp(walkStep(c.sbp, SBP_BASELINE + (isExercise ? 10 : 0), 120, SBP_NOISE * c.amplitude, this.gauss), 70, 220);
      c.dbp = clamp(walkStep(c.dbp, DBP_BASELINE + (isExercise ? 5 : 0), 120, DBP_NOISE * c.amplitude, this.gauss), 40, 130);
    }

    const nextSequence = (deviceId: string): number => {
      const next = (this.sequences.get(deviceId) ?? 0) + 1;
      this.sequences.set(deviceId, next);
      return next;
    };

    const emit = (deviceId: string, crewId: string | null, payload: Record<string, unknown>) => {
      const def = deviceById(deviceId);
      if (!def) return;
      // Fault handling (SPEC §6.3)
      let quality: QualityStatus = "good";
      let finalPayload: Record<string, unknown> = payload;
      const faultActive = this.scenario === "sensor_fault" && this.fault?.deviceId === deviceId;
      if (faultActive && this.fault) {
        if (this.fault.kind === "stuck") {
          const frozen = this.stuckPayloads.get(deviceId);
          if (frozen) {
            finalPayload = { ...frozen };
          } else {
            this.stuckPayloads.set(deviceId, { ...payload });
          }
          if (this.fault.stuckValue !== undefined) {
            const key = PRIMARY_FIELD[deviceId];
            if (key) finalPayload = { ...finalPayload, [key]: this.fault.stuckValue };
          }
          quality = "suspect";
        } else if (this.fault.kind === "drift") {
          const offset = (this.fault.driftPerMin ?? 0.5) * simMinutes;
          const drifted: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(payload)) {
            if (typeof v === "number" && Number.isFinite(v) && !DRIFT_SKIP_KEYS.has(k)) drifted[k] = v + offset;
            else drifted[k] = v;
          }
          finalPayload = drifted;
          quality = "suspect";
        } else if (this.fault.kind === "dropout") {
          quality = "suspect";
        }
      }
      // comm_loss: dữ liệu vẫn ghi — received_at skew +10–15 min, quality suspect (SPEC §6.3).
      let receivedAtMs = this.simTimeMs;
      if (this.scenario === "comm_loss") {
        receivedAtMs += (600 + this.rng() * 300) * 1000;
        quality = "suspect";
      }

      const sequence = nextSequence(deviceId);
      const event: TelemetryEvent = {
        schema_version: "1.0",
        event_id: crypto.randomUUID(),
        mission_id: this.missionId,
        ...(crewId ? { crew_id: crewId } : {}),
        device_id: deviceId,
        device_type: deviceTypeOf(def),
        location_id: def.locationId,
        source: { mode: "synthetic" },
        observed_at: iso(this.simTimeMs),
        received_at: iso(receivedAtMs),
        sequence,
        quality: { status: quality },
        payload: finalPayload,
      };
      events.push(event);
    };

    // dropout cần check trước khi emit để có thể bỏ qua event (nhưng vẫn tiêu thụ sequence).
    const shouldDrop = (deviceId: string): boolean => {
      if (!(this.scenario === "sensor_fault" && this.fault?.deviceId === deviceId && this.fault.kind === "dropout")) return false;
      const p = this.fault.p ?? 0.3;
      if (this.rng() < p) {
        nextSequence(deviceId); // sequence gap — event bị bỏ nhưng số vẫn tiêu thụ (SPEC §6.3/§6.4)
        return true;
      }
      return false;
    };

    for (const [crewId, c] of this.crew) {
      const activity = Math.max(0, Math.round(ACTIVITY_BASELINE + this.gauss() * ACTIVITY_NOISE));
      // biomonitor — 1 Hz
      if (!shouldDrop("biomonitor")) {
        emit("biomonitor", crewId, {
          heart_rate_bpm: round2(c.hr),
          spo2_pct: round2(c.spo2),
          respiratory_rate_bpm: round2(c.rr),
          skin_temperature_c: round2(c.skinTemp),
          activity_counts: activity,
        });
      }
      // thermo-mini — 0.2 Hz (mỗi 5 tick)
      if (t % 5 === 0 && !shouldDrop("thermo-mini")) {
        emit("thermo-mini", crewId, { core_temperature_c: round2(c.coreTemp) });
      }
      // bp-ecg — mỗi 60 s sim (SPEC §6.2)
      if (t % 60 === 0 && !shouldDrop("bp-ecg")) {
        emit("bp-ecg", crewId, {
          systolic_mmhg: round2(c.sbp),
          diastolic_mmhg: round2(c.dbp),
          heart_rate_bpm: round2(c.hr),
        });
      }
      // pulse-oximeter — 1 Hz
      if (!shouldDrop("pulse-oximeter")) {
        emit("pulse-oximeter", crewId, {
          spo2_pct: round2(c.spo2),
          pulse_bpm: round2(c.hr),
          signal_quality: round2(clamp(0.9 + this.gauss() * 0.05, 0, 1)),
        });
      }
      // respiratory-assessment — 1 Hz
      if (!shouldDrop("respiratory-assessment")) {
        emit("respiratory-assessment", crewId, {
          respiratory_rate_bpm: round2(c.rr),
          tidal_volume_ml: round2(c.tidal),
          minute_ventilation_l_min: round2((c.rr * c.tidal) / 1000),
        });
      }
      // cad — personal dosimeter — 1 Hz
      if (!shouldDrop("cad")) {
        emit("cad", crewId, {
          dose_rate_uSv_h: round3(doseRate),
          cumulative_equivalent_dose_mSv: round5(this.mission.cadCumulative),
        });
      }
    }

    // --- Cabin / môi trường — mission-scoped ---
    if (!shouldDrop("o2-analyzer")) {
      emit("o2-analyzer", null, {
        o2_pct: round2(this.mission.o2),
        o2_partial_pressure_kpa: round2((this.mission.o2 / 100) * this.mission.pressure),
      });
    }
    if (!shouldDrop("co2-analyzer")) {
      emit("co2-analyzer", null, {
        co2_ppm: round2(this.mission.co2),
        // PCO₂ ≈ ppm × 760 mmHg / 1e6 (Dalton) — suy ra từ pressure cabin, không phải threshold.
        co2_mmhg: round3((this.mission.co2 * (this.mission.pressure / 101.325) * 760) / 1e6),
      });
    }
    if (!shouldDrop("pressure-sensor")) {
      emit("pressure-sensor", null, { pressure_kpa: round2(this.mission.pressure) });
    }
    // cabin.climate — temperature-sensor + humidity-sensor chung một stream simulator (SPEC §4.3 note)
    if (!shouldDrop("temperature-sensor")) {
      emit("temperature-sensor", null, { temperature_c: round2(this.mission.cabinTemp) });
    }
    if (!shouldDrop("humidity-sensor")) {
      emit("humidity-sensor", null, { humidity_pct: round2(this.mission.humidity) });
    }

    // --- Exercise — ergometer session 8' sim (CEVIS) ---
    if (exerciseActive && !shouldDrop("ergometer")) {
      const elapsed = t;
      const exCrew = this.crew.get(this.exerciseCrewId);
      emit("ergometer", this.exerciseCrewId, {
        power_w: round2(Math.max(0, EXERCISE_POWER + this.gauss() * EXERCISE_POWER_NOISE)),
        cadence_rpm: round2(Math.max(0, EXERCISE_CADENCE + this.gauss() * EXERCISE_CADENCE_NOISE)),
        session_id: `ergo-${this.seed}`,
        elapsed_s: elapsed,
        heart_rate_bpm: exCrew ? round2(exCrew.hr) : HR_EXERCISE,
      });
    }

    // --- CANS — mỗi 60 s integration window ---
    if (t % 60 === 0 && !shouldDrop("cans")) {
      const multEnv = this.scenario === "radiation_event" ? 1 + (this.cansMultiplier - 1) * radiationEnv : 1;
      const mean = CANS_BASELINE_COUNTS * multEnv;
      const neutronCount = Math.max(0, Math.round(mean + this.gauss() * CANS_NOISE * Math.sqrt(multEnv)));
      emit("cans", null, {
        device_id: "CANS-01",
        neutron_count: neutronCount,
        integration_seconds: 60,
        dose_rate_uSv_h: round3(doseRate),
        // Bins do Sky định nghĩa — KHÔNG phải giao thức CANS thật (SPEC §4.4-F).
        energy_spectrum: spectrumFromCounts(neutronCount),
        quality: "simulated",
      });
    }

    // Validate + persist + publish
    const parsed: TelemetryEvent[] = [];
    for (const ev of events) {
      const result = TelemetryEventSchema.safeParse(ev);
      if (!result.success) {
        // Fail fast — bug trong simulator phải lộ ở test, không lọt vào DB.
        throw new Error(`invalid telemetry event: ${result.error.message}`);
      }
      const devicePayload = SIMULATED_PAYLOAD_SCHEMAS[ev.device_id];
      if (devicePayload && !devicePayload.safeParse(ev.payload).success) {
        throw new Error(`invalid payload for device ${ev.device_id}`);
      }
      parsed.push(ev);
    }

    this.store.insertBatch(parsed);
    for (const ev of parsed) telemetryBus.emit("telemetry", ev);

    this.tickIndex += 1;
    this.simTimeMs += 1000;
    return parsed;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function round5(n: number): number {
  return Math.round(n * 100000) / 100000;
}

/** Chia neutron_count vào 4 bin năng lượng giả — bins do Sky định nghĩa, không phải giao thức CANS thật. */
function spectrumFromCounts(total: number): { energy_mev: number; counts: number }[] {
  const bins = [
    { energy_mev: 0.5, weight: 0.52 },
    { energy_mev: 2, weight: 0.28 },
    { energy_mev: 8, weight: 0.14 },
    { energy_mev: 30, weight: 0.06 },
  ];
  return bins.map((b) => ({ energy_mev: b.energy_mev, counts: Math.round(total * b.weight) }));
}

/** Singleton dùng bởi REST/WS; tests tự dựng instance riêng với store in-memory. */
export const simulationEngine = new SimulationEngine();
