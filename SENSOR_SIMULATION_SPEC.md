# SENSOR_SIMULATION_SPEC — Sky Agent telemetry (devices & data)

> Trạng thái: SPEC đã được implement cho **backend** (2026-11-14, `apps/backend/src/sensors/`). **Không** đụng frontend.
> Dự án HKT — NASA Space Apps Challenge 2026 (HCMC, 14–15/11/2026). Bám HKT contract trong `AGENTS.md`.

## 0. Mục đích, phạm vi, non-goals

Sky cần một nguồn telemetry thống nhất cho 3 nhóm nguồn: **thiết bị thật** (tương lai), **replay** dữ liệu nghiên cứu công khai, và **synthetic** do simulator sinh. Tài liệu này định nghĩa:

- Device Registry cho **38 thiết bị/hệ thống** theo brief, phân biệt: thiết bị từng bay/thử nghiệm trên ISS, thiết bị nghiên cứu, thiết bị NASA đánh giá, thiết bị đang phát triển, và giả định của simulator.
- Canonical Telemetry Envelope + payload TS cho từng thiết bị.
- Simulation models cho **12 stream lõi** (xem §6) — phần còn lại registry-only, chưa sim.
- Storage (SQLite/drizzle), REST + WebSocket API, fault injection, scenario engine.
- Quy tắc nhãn nguồn: UI/API/log luôn nói rõ dữ liệu là **synthetic**.

Non-goals (bản này):

- **Không raw ECG 250 Hz** và không ảnh siêu âm/OCT/ultrasound — ECG/imaging chỉ truyền metadata theo pattern `asset_id` (xem §4.4).
- Không replay dữ liệu OSDR (để phase sau; `source.mode = "replay"` đã có trong schema).
- Không push sang broadcast bus `change_events` (agent turns không bị nhiễu; xem §11).
- Không auth trên các endpoint (demo single-box, giống `/api/claims`, `/api/events`).
- **Không thay đổi frontend** — apps/web giữ nguyên.
- Không ngưỡng y khoa/cảnh báo thật; mọi ngưỡng ở đây là **tham số mô phỏng minh hoạ**, không phải medical guidance.

## 1. Hard rules (bám HKT contract)

1. Dữ liệu Sky sinh ra là **synthetic**; `source.mode` luôn là `synthetic` khi simulator chạy. UI phải hiển thị nhãn SIMULATED.
2. **AI không quyết định một mình** — simulator chỉ tạo dữ liệu; mọi kết luận y khoa thuộc deterministic rules + phi hành gia xác nhận.
3. Mọi ngưỡng/giá trị tham chiếu trong code phải kèm comment trỏ `source_url` (xem §13). Các số **baseline** ở §6 là **illustrative simulator tuning**, không phải ngưỡng lâm sàng.
4. Không dữ liệu cá nhân thật; crew ids là **hư cấu** (giống apps/web). Không tên phi hành gia thật, không dữ liệu y tế thật.
5. Khi có thiết bị thật/replay sau này: `source.mode` đổi tương ứng, cùng envelope — consumers không đổi.

## 2. Nguồn tài liệu (checked 2026-11-14)

| Chủ đề | URL |
|---|---|
| CSA Bio-Monitor (thông số đo) | https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp |
| CSA CANS (neutron spectrometer, đang phát triển) | https://www.asc-csa.gc.ca/eng/iss/cans.asp |
| NASA Open Science Data Repository (OSDR) | https://science.nasa.gov/biological-physical/data/osdr/ |
| NASA OSDR Environmental Data App (EDA) | https://visualization.osdr.nasa.gov/eda/ |
| NASA Space Radiation Analysis Group (SRAG) | https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm |
| JAXA Human Spaceflight Technology | https://humans-in-space.jaxa.jp/ |
| ESA (EveryWear, T-Mini) | https://www.esa.int/ |
| NASA SMA — ISS Environmental Health | https://sma.nasa.gov/ |
| NASA Technical Reports Server | https://ntrs.nasa.gov/ |
| Human Research Program — Evidence Reports | https://humanresearchroadmap.nasa.gov/evidencereports |
| NASA-STD-3001 Vol 2 (habitable environment) | https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02 |
| Circulation 2026 — ISS LV volume/pressure response | https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665 |

> Sự tồn tại của một thiết bị trong registry **không** nghĩa là nó có trên mọi tàu. Không có danh sách công khai duy nhất bao quát toàn bộ thiết bị y tế NASA/ESA/JAXA/SpaceX; bảng này tổng hợp từ các nguồn trên + tài liệu HKT, ưu tiên thiết bị có tài liệu công khai. Các "trường dữ liệu bổ sung" (vd. airflow, particle concentration) là mở rộng hợp lý của Sky cho mô phỏng, không phải cam kết về một bộ cảm biến cố định trên ISS.

## 3. Flight status & nhãn nguồn

`flightStatus` (trạng thái thực ngoài đời):

| Giá trị | Nghĩa |
|---|---|
| `iss_operational` | Đã dùng vận hành trên ISS |
| `iss_tested` | Đã thử nghiệm/thử nghiệm một phần trên ISS |
| `iss_research` | Thiết bị nghiên cứu trên ISS |
| `nasa_evaluated` | NASA đánh giá/thử nghiệm, chưa phải thiết bị vận hành chuẩn |
| `development` | Đang phát triển, chưa bay vận hành |

`simulated` (Sky có mô phỏng hay chưa) — **trực giao** với `flightStatus`:

- `simulated: true` ⇒ Sky sinh dữ liệu synthetic cho thiết bị này (xem §6).
- `simulated: false` ⇒ registry-only trong bản này: adapter interface đã có, data chưa sinh.

`source.mode` ∈ `synthetic | replay | real` — envelope luôn mang mode này; consumer phải tự kiểm tra.

## 4. Canonical Telemetry Envelope

### 4.1 Envelope (mọi thiết bị, mọi mode)

```ts
type SourceMode = "synthetic" | "replay" | "real";
export type QualityStatus = "good" | "suspect" | "invalid";

export interface TelemetryEvent<T> {
  schema_version: "1.0";
  event_id: string;            // uuid
  mission_id: string;          // hư cấu, vd. "SIM-001"
  crew_id?: string;            // hư cấu, vd. "ayla-reyes"; thiếu cho thiết bị không gắn người (cabin, CAD mặc định theo crew)
  device_id: string;           // registry id, vd. "biomonitor"
  device_type: string;         // registry sky namespace root, vd. "biomonitor"
  location_id?: string;        // vd. "HAB-01", "NOD3", "CANS-LOC" — hư cấu cho Sky
  source: { mode: SourceMode; dataset_id?: string };
  observed_at: string;         // UTC ISO-8601, ms precision
  received_at: string;         // UTC ISO-8601 — sim có thể skew khi scenario comm_loss
  sequence: number;            // per (mission_id, device_id), tăng dần
  quality: { status: QualityStatus; confidence?: number };   // confidence 0..1, tuỳ chọn
  payload: T;
}
```

### 4.2 Nguyên tắc

- **Không** nhét waveform/ảnh/binary vào envelope. File lớn → asset store; envelope chỉ mang `asset_id` + metadata (§4.4).
- `sequence` cho phép phát hiện gap khi sensor mất tín hiệu (scenario `sensor_fault` dropout).
- `observed_at` là thời điểm đo; `received_at` là thời điểm hệ thống nhận — lệch nhau ở `comm_loss`.
- Mọi field số trong payload có đơn vị **trong tên field** (`_bpm`, `_pct`, `_kpa`, `_c`, `_ppm`, `_uSv_h`, …).

### 4.3 Bảng thiết bị registry (38)

Registry là **code** (single source of truth: `src/sensors/registry.ts`), không phải bảng DB — tránh lệch giữa DB và code khi demo. DB chỉ lưu events.

| # | id | Tên | Tổ chức | flightStatus | Sky namespace | SIM |
|---|---|---|---|---|---|---|
| 1 | `biomonitor` | Bio-Monitor / AstroSkin | CSA | iss_operational | `biomonitor.*` | ✅ |
| 2 | `everywear` | ESA EveryWear (smartshirt + patches) | ESA / CNES | iss_tested | `everywear.*` | — |
| 3 | `thermo-mini` | Thermo-Mini / T-Mini (core temp est.) | ESA | iss_research | `thermoregulation.core_temperature_c` | ✅ |
| 4 | `bp-ecg` | Blood Pressure / ECG Monitor | NASA / JAXA | iss_operational | `cardiovascular.bp` · `cardiovascular.ecg` | ✅ |
| 5 | `ultrasound` | Diagnostic Ultrasound | NASA / JAXA | iss_operational | `imaging.ultrasound` | — |
| 6 | `pulse-oximeter` | Pulse Oximeter | NASA / JAXA | iss_operational | `cardiovascular.spo2` | ✅ |
| 7 | `respiratory-assessment` | Respiratory Assessment | NASA | iss_operational | `respiratory.*` | ✅ |
| 8 | `urine-analyzer` | Urine Analyzer | NASA / JAXA | iss_operational | `lab.urine` | — |
| 9 | `blood-analyzer` | Blood Sampling / Analyzer | NASA | iss_operational | `lab.blood` | — |
| 10 | `tempus` | Tempus ALS / Pro | NASA (evaluated) | nasa_evaluated | `tempus.*` | — |
| 11 | `oct` | OCT / Ocular Examination (SANS) | NASA | iss_research | `ocular.oct` | — |
| 12 | `defibrillator` | Medical Defibrillator | NASA | iss_operational | `emergency.defibrillator` | — |
| 13 | `cad` | Crew Active Dosimeter (CAD) | NASA | iss_operational | `radiation.personal_dose` · `radiation.dose_rate` | ✅ |
| 14 | `tepc` | Tissue Equivalent Proportional Counter | NASA | iss_operational | `radiation.absorbed_dose` · `radiation.spectrum` | — |
| 15 | `ram` | Radiation Area Monitor (RAM) | NASA | iss_operational | `radiation.area` | — |
| 16 | `cpds` | Charged Particle Directional Spectrometer | NASA | iss_research | `radiation.particle_flux` | — |
| 17 | `passive-dosimeter` | Crew Passive Dosimeter | NASA | iss_operational | `radiation.passive_dose` | — |
| 18 | `hera-rad-rem2` | HERA / RAD / REM2 | NASA | iss_research | `radiation.environment` | — |
| 19 | `o2-analyzer` | Oxygen Analyzer | NASA (ISS EHS) | iss_operational | `cabin.o2` | ✅ |
| 20 | `co2-analyzer` | CO₂ Analyzer | NASA (ISS EHS) | iss_operational | `cabin.co2` | ✅ |
| 21 | `pressure-sensor` | Cabin Pressure Sensor | NASA | iss_operational | `cabin.pressure` | ✅ |
| 22 | `temperature-sensor` | Cabin Temperature Sensor | NASA | iss_operational | `cabin.temperature` | ✅ |
| 23 | `humidity-sensor` | Humidity Sensor | NASA | iss_operational | `cabin.humidity` | ✅ |
| 24 | `co-monitor` | CO Monitor | NASA (ISS EHS) | iss_operational | `cabin.co` | — |
| 25 | `toxic-gas` | Toxic Gas Analyzer (HCl, HCN) | NASA (ISS EHS) | iss_operational | `cabin.toxic_gas` | — |
| 26 | `voc-analyzer` | Volatile Organic Analyzer | NASA (ISS EHS) | iss_operational | `cabin.voc` | — |
| 27 | `water-quality` | Water Quality Analyzer (TOC, pH, conductivity) | NASA (ISS EHS) | iss_operational | `water.quality` | — |
| 28 | `microbial-sampler` | Microbial Air Sampler | NASA (ISS EHS) | iss_operational | `air.microbial` | — |
| 29 | `sound-level` | Sound Level Meter | NASA | iss_operational | `acoustic.spl` | — |
| 30 | `audio-dosimeter` | Audio Dosimeter | NASA | iss_operational | `acoustic.dose` | — |
| 31 | `airflow` | Airflow / Ventilation Sensor (Sky extension) | NASA | iss_operational | `cabin.airflow` | — |
| 32 | `particulate` | Particulate Monitor (Sky extension) | NASA | iss_operational | `cabin.particulate` | — |
| 33 | `treadmill` | Treadmill (T2 / COLBERT) | NASA | iss_operational | `exercise.treadmill` | — |
| 34 | `ergometer` | Cycle Ergometer (CEVIS) | NASA | iss_operational | `exercise.ergometer` | ✅ |
| 35 | `ared` | Advanced Resistive Exercise Device (ARED) | NASA | iss_operational | `exercise.ared` | — |
| 36 | `sleep-monitor` | Activity / Sleep Monitor | NASA | iss_operational | `activity.sleep` | — |
| 37 | `body-mass` | Body Mass Measurement | NASA | iss_operational | `body.mass` | — |
| 38 | `cans` | Canadian Active Neutron Spectrometer (CANS) | CSA | development | `radiation.neutron` | ✅ |

> SIM = được Sky simulator sinh dữ liệu (13 registry rows ⇒ 12 streams, vì `temperature-sensor` + `humidity-sensor` chung một stream simulator `cabin.climate`). `airflow`/`particulate` là mở rộng Sky, không phải cam kết bộ cảm biến cố định trên ISS. CANS đang phát triển (CSA công bố đầu tư tiếp 2026-02); **không** giả định đã bay vận hành.

Mỗi entry registry kèm `sourceUrl` (§2) và `description` 1–2 câu; `simulated` true/false; `location` mặc định hư cấu (`HAB-01`, `NOD3`, …).

### 4.4 Payload schemas (TS, theo nhóm)

```ts
// A. Wearable
interface BiomonitorPayload { heart_rate_bpm: number; spo2_pct: number; respiratory_rate_bpm: number; skin_temperature_c: number; activity_counts: number; }
interface EveryWearPayload { heart_rate_bpm: number; activity_steps: number; skin_temperature_c: number; vascular_index?: number; }
interface ThermoMiniPayload { core_temperature_c: number; }
interface BpEcgPayload { systolic_mmhg: number; diastolic_mmhg: number; heart_rate_bpm: number; }

// B. Diagnostic
interface UltrasoundMeasurement { depth_cm: number; frequency_mhz: number; structure: string; measurement_mm?: number; asset_id?: string; }
interface PulseOximeterPayload { spo2_pct: number; pulse_bpm: number; signal_quality: number; }   // 0..1
interface RespiratoryPayload { respiratory_rate_bpm: number; tidal_volume_ml: number; minute_ventilation_l_min?: number; }
interface UrineAnalyzerPayload { ph: number; specific_gravity: number; glucose_mg_dl?: number; protein_mg_dl?: number; }
interface BloodAnalyzerPayload { hemoglobin_g_dl?: number; hematocrit_pct?: number; biomarkers?: Record<string, number>; }
interface TempusPayload { heart_rate_bpm?: number; systolic_mmhg?: number; diastolic_mmhg?: number; spo2_pct?: number; etco2_mmhg?: number; temperature_c?: number; procedure?: string; asset_id?: string; }
interface OctPayload { rnfl_thickness_um?: number; intraocular_pressure_mmhg?: number; asset_id?: string; }   // SANS research
interface DefibrillatorPayload { device_status: "ready" | "shock_delivered" | "self_test" | "fault"; shock_energy_j?: number; ecg_asset_id?: string; }

// C. Radiation
interface CadPayload { dose_rate_uSv_h: number; cumulative_equivalent_dose_mSv: number; session_id?: string; }
interface TepcPayload { absorbed_dose_rate_uGy_h: number; spectrum?: { energy_mev: number; counts: number }[]; }
interface RamPayload { cumulative_dose_uSv: number; location_id: string; }
interface CpdsPayload { particle_flux_cm2_s: number; direction: "x" | "y" | "z"; energy_bins?: { energy_mev: number; counts: number }[]; }
interface PassiveDosimeterPayload { cumulative_dose_mSv: number; read_at?: string; }   // chỉ có sau khi lab đọc
interface HeraRadRem2Payload { instrument: "HERA" | "RAD" | "REM2"; dose_rate_uGy_h?: number; galactic_cosmic_ray_flux?: number; solar_particle_event?: boolean; }

// D. Environment
interface O2AnalyzerPayload { o2_pct: number; o2_partial_pressure_kpa?: number; }
interface Co2AnalyzerPayload { co2_ppm: number; co2_mmhg?: number; }
interface PressurePayload { pressure_kpa: number; }
interface TemperaturePayload { temperature_c: number; }
interface HumidityPayload { humidity_pct: number; }
interface CoMonitorPayload { co_ppm: number; }
interface ToxicGasPayload { hcl_ppm?: number; hcn_ppm?: number; }
interface VocPayload { voc_ppb?: number; dominant_compounds?: string[]; }
interface WaterQualityPayload { toc_mg_l?: number; ph?: number; conductivity_uS_cm?: number; }
interface MicrobialPayload { sample_id: string; cfu_per_m3?: number; analyzed_at?: string; }   // kết quả trễ sau phân tích
interface SoundLevelPayload { spl_dba: number; frequency_bands?: Record<string, number>; }
interface AudioDosimeterPayload { noise_exposure_dba: number; dose_pct: number; }
interface AirflowPayload { airflow_m_s: number; fan_rpm?: number; }
interface ParticulatePayload { particulate_ug_m3: number; size_bins_um?: Record<string, number>; }

// E. Exercise
interface TreadmillPayload { speed_kmh: number; duration_s: number; heart_rate_bpm?: number; harness_load_kg?: number; }
interface ErgometerPayload { power_w: number; cadence_rpm: number; session_id: string; elapsed_s: number; heart_rate_bpm?: number; }
interface AredPayload { exercise_type: string; resistance_kg: number; sets: number; repetitions: number; }
interface SleepMonitorPayload { activity_counts: number; sleep_period_min?: number; sleep_efficiency_pct?: number; }
interface BodyMassPayload { body_mass_kg: number; }

// F. Next-gen — giá trị/bin do Sky định nghĩa, KHÔNG phải giao thức CANS thật
interface CansPayload { device_id: "CANS-01"; neutron_count: number; integration_seconds: number; dose_rate_uSv_h: number; energy_spectrum: { energy_mev: number; counts: number }[]; quality: "simulated"; }
```

### 4.5 ECG/imaging assets (pattern, chưa implement)

Asset lưu ngoài (file/blob); envelope mang:

```ts
interface AssetRef { asset_id: string; sample_rate_hz?: number; start_time: string; duration_ms?: number; format: string; }
```

## 5. Tần suất mô phỏng (SKY SIMULATOR, không phải spec của NASA)

| Stream | Tần suất sim | Kiểu |
|---|---|---|
| ECG waveform | (không sim bản này) | signal chunks |
| Heart rate (biomonitor, bp-ecg, pulse-ox, ergometer HR) | 1 Hz | numeric |
| SpO₂ | 1 Hz | numeric |
| Respiratory rate | 1 Hz | numeric |
| Tidal volume | 1 Hz | numeric |
| Core / skin temperature | 0.2 Hz | numeric |
| Cabin CO₂ / O₂ / pressure / temperature / humidity | 1 Hz | numeric |
| Radiation (CAD / CANS) | 1 Hz | numeric + cumulative |
| Exercise (ergometer) | 1 Hz trong session | session + metrics |
| Blood / urine / microbial / imaging | theo phiên (chưa sim) | lab report |

## 6. Simulator — model & scenario (12 streams)

### 6.1 Nguyên tắc

- **Deterministic-first**: PRNG seeded (mulberry32), seed mặc định `"sky-sim-1"` (override `POST .../sim/start`). Cùng seed + cùng scenario ⇒ cùng chuỗi events.
- **Không nhảy số thô**: mỗi metric = baseline random-walk (mean-reverting, σ nhỏ) + scenario modifiers với **first-order lag** (`tau`) — mô phỏng nhân quả có độ trễ (CO₂ ↑ → RR/HR ↑ sau τ; không kéo SpO₂ xuống vô cớ).
- Cá nhân hoá nhẹ: mỗi crew member một `phase`/`amplitude` offset ổn định trong session (khác biệt giữa cá nhân).
- Event được ghi SQLite (`telemetry_events`) **và** broadcast in-process WS.
- Giờ mô phỏng chạy theo simulation clock: `1×`, `10×`, `100×`, `pause`. `observed_at` dùng sim-time; `received_at` = sim-time (+ skew khi `comm_loss`).

### 6.2 Baselines (illustrative simulator tuning — KHÔNG phải threshold lâm sàng; nguồn tham khảo §2, §13)

| Metric | Baseline | Noise (σ) | Ghi chú |
|---|---|---|---|
| `heart_rate_bpm` | 68 | 3 | random walk, clamp 45–180 |
| `spo2_pct` | 98 | 0.3 | clamp 88–100 |
| `respiratory_rate_bpm` | 14 | 0.8 | clamp 8–40 |
| `skin_temperature_c` | 33.5 | 0.1 | clamp 30–37 |
| `core_temperature_c` | 37.0 | 0.05 | clamp 35.5–38.5 |
| `systolic_mmhg` / `diastolic_mmhg` | 118 / 76 | 4 / 3 | đo theo phiên bp-ecg: mỗi 60 s sim |
| `tidal_volume_ml` | 500 | 40 | clamp 200–2000 |
| `co2_ppm` | 850 | 15 | scenario `co2_accumulation` ramp → ~2500 (τ≈120 s). 2500 ppm là **target demo**, thấp xa ngưỡng ISS (xem NASA-STD-3001 Vol 2); không phải alarm threshold |
| `o2_pct` | 20.9 | 0.05 | clamp 19–23 |
| `pressure_kpa` | 101.3 | 0.1 | |
| `temperature_c` | 23.5 | 0.15 | |
| `humidity_pct` | 40 | 0.8 | |
| `activity_counts` | 5 | 4 | Poisson-ish |
| `dose_rate_uSv_h` (CAD) | 0.5 | 0.05 | scenario `radiation_event`: đỉnh 20–80 (spike decay τ≈180 s) |
| `cumulative_equivalent_dose_mSv` | 0.0 | — | tích phân của dose_rate |
| `neutron_count` (CANS) | 12 / 60 s window | 4 | scenario `radiation_event`: ×6–12 |
| `power_w` / `cadence_rpm` (ergometer) | session fixture: 140 / 85 | 8 / 3 | chỉ có trong `exercise` |
| `hr` khi exercise | 142 ± 8 | — | τ≈45 s sau khi session bắt đầu |

### 6.3 Scenarios (parameter presets + combinators — mọi scenario đều synthetic)

| Scenario | Tác động chính | Dùng cho demo |
|---|---|---|
| `normal` | Chỉ baselines | Trạng thái bình thường |
| `exercise` | Ergometer session 8′ sim + HR/RR/power↑, SpO₂ giữ 97–99 | "Phi hành gia tập, xem thay đổi" |
| `co2_accumulation` | CO₂ 850→~2500 ppm (τ 120 s); RR +4, HR +6 (τ 60 s); **SpO₂ không điều khiển trực tiếp** — chỉ giảm nếu RR/SpO₂ coupling kích hoạt ở mức nặng (mặc định: không) | Tile CO₂ trend |
| `radiation_event` | CAD dose_rate 0.5→(20–80) uSv/h, decay; CANS neutron_count ×6–12; cumulative dose tăng | Cảnh báo bức xạ |
| `sensor_fault` | Một device mục tiêu (`fault.deviceId`) lỗi: `dropout` (bỏ event p=0.3, sequence gap), `stuck` (constant), `drift` (offset tuyến tính); quality → `suspect`/`invalid` | "Mất tín hiệu / lỗi hiệu chuẩn" |
| `anomaly_symptom` | **Một** crew member (hư cấu, vd. `ayla-reyes`): HR +12, SpO₂ −1.5, RR +2, onset chậm τ≈300 s; thiết bị khác vẫn nominal | Demo "một người bất thường" |
| `comm_loss` | `received_at` skew +10–15 min sim, quality `suspect`; dữ liệu vẫn ghi nhưng đánh dấu buffered | Demo "mất liên lạc Trái Đất" |

Fault injection (cho `sensor_fault`), config khi start:

```ts
interface FaultConfig { deviceId: string; kind: "dropout" | "stuck" | "drift"; p?: number; driftPerMin?: number; stuckValue?: number; }
```

### 6.4 Engine behaviour

- Tick = 1 s sim-time (mọi device phát theo tần suất §5).
- `speed` ∈ {1, 10, 100} — wall-clock multiplier; `pause` dừng tick, events ngưng (status → `paused`).
- `sequence` per (mission_id, device_id) tăng dần, bắt đầu 1; giữ trong memory của engine; khi restart reset về 1? **Không** — sequence persist bằng cách đọc MAX(sequence) từ DB khi adapter init (đơn giản: sequence = bộ đếm in-memory, ghi rõ trong status payload).
- Sau mỗi event: `telemetry_events` insert (drizzle, transaction cho batch tick) + `eventsBus.emit("telemetry", event)` (EventEmitter3 riêng `telemetryBus`, **không** tái dùng `change_events`).

## 7. Storage (SQLite + drizzle — theo pattern `eventsClient.ts`)

File DB: `SKY_DB_PATH` (mặc định giống backend hiện có). Connection riêng `sensorsClient.ts` (bun test isolation), WAL + `foreign_keys = ON`, `ensureSchema()` idempotent — **không** dùng drizzle migrate cho demo paths (giống change_events).

```sql
CREATE TABLE IF NOT EXISTS telemetry_events (
  event_id        TEXT PRIMARY KEY,          -- uuid
  mission_id      TEXT NOT NULL,
  crew_id         TEXT NULL,
  device_id       TEXT NOT NULL,
  device_type     TEXT NOT NULL,
  location_id     TEXT NULL,
  source_mode     TEXT NOT NULL CHECK (source_mode IN ('synthetic','replay','real')),
  dataset_id      TEXT NULL,
  observed_at     TEXT NOT NULL,             -- UTC ISO-8601
  received_at     TEXT NOT NULL,
  sequence        INTEGER NOT NULL,
  quality_status  TEXT NOT NULL CHECK (quality_status IN ('good','suspect','invalid')),
  payload         TEXT NOT NULL              -- JSON; đọc phải JSON.parse
);
CREATE INDEX IF NOT EXISTS telemetry_events_device_time ON telemetry_events (device_id, observed_at);
CREATE INDEX IF NOT EXISTS telemetry_events_mission_time ON telemetry_events (mission_id, observed_at);
```

drizzle schema `src/db/schema/telemetryEvents.ts` export `telemetryEvents`; repository `src/db/repositories/telemetry.ts`: `insertBatch(events)`, `recent({deviceId?, missionId?, limit})` (ORDER BY observed_at DESC, LIMIT ≤ 500), `maxSequence(missionId, deviceId)`.

## 8. API

Tất cả response `application/json`. Lỗi: `{ ok: false, error: string }` + HTTP status (theo style `eventsRoutes.ts`). REST additive; request lạ → 404 như server hiện tại.

### 8.1 REST

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/sensors/devices` | `{ count: 38, devices: DeviceDef[] }` — registry đầy đủ (metadata only) |
| GET | `/api/sensors/devices/:id` | 404 nếu id lạ |
| GET | `/api/sensors/metrics` | Catalog metric specs (đơn vị, tần suất, nguồn) dùng bởi §6.2 |
| GET | `/api/sensors/events?deviceId=&missionId=&limit=50` | Recent events từ DB (limit ≤ 500, mặc định 50) |
| POST | `/api/sensors/sim/start` | Body: `{ scenario?, speed?, missionId?, crewId?, seed?, fault? }` — start engine (nếu đang chạy: 409 `{ok:false, error:"already_running"}`) |
| POST | `/api/sensors/sim/stop` | Dừng engine; giữ events trong DB |
| POST | `/api/sensors/sim/reset` | Stop + xoá events của mission hiện tại (demo helper) |
| GET | `/api/sensors/sim/status` | `{ running, scenario, speed, missionId, sequence, startedAt, simulated: true }` |

`scenario` ∈ `normal | exercise | co2_accumulation | radiation_event | sensor_fault | anomaly_symptom | comm_loss` (zod enum). `speed` ∈ `1 | 10 | 100` (number). `fault` theo §6.3 (bắt buộc khi `scenario = sensor_fault`, thiếu → 400).

### 8.2 WebSocket `/ws/telemetry`

Bun `websocket` handler trong `Bun.serve` (cùng chỗ `fetch` ở `server.ts`). Nâng cấp bằng `server.upgrade(req)` khi pathname = `/ws/telemetry`.

Client → server (optional):

```json
{ "type": "subscribe", "deviceIds": ["biomonitor", "co2-analyzer"], "missionId": "SIM-001" }
```

Server → client frames:

```json
{ "type": "telemetry", "event": { ...TelemetryEvent } }
{ "type": "sim_state", "state": { ...sim status } }
```

Subscriptions theo `deviceIds`/`missionId` (bỏ trống = mọi event). Client gửi `{"type":"ping"}` → server trả `{"type":"pong"}`. Không auth (demo). Khi engine stop → server broadcast `sim_state` cuối.

## 9. Cấu trúc code (apps/backend)

```
src/sensors/
  registry.ts        # 38 DeviceDef — single source of truth, export DEVICES: DeviceDef[]
  metrics.ts         # METRIC_SPECS (đơn vị, freq, baseline, source_url comment)
  envelope.ts        # zod: TelemetryEventSchema (+ payload schemas per device_type)
  prng.ts            # mulberry32 + gaussian (Box–Muller), seeded
  engine.ts          # SimulationEngine: start/stop/reset/status/tick; scenarios §6.3
  store.ts           # sensorsClient + telemetry repo wrapper (insertBatch, recent, maxSequence)
  routes.ts          # handleSensorsRequest(req): Response | null  (fall-through như eventsRoutes)
  ws.ts              # wsHandlers { open, message, close } + subscription filter
src/db/schema/telemetryEvents.ts
src/db/repositories/telemetry.ts
tests/sensors-registry.test.ts   # 38 unique ids; mỗi entry có sourceUrl; exactly các ids ở §4.3 simulated=true; namespace prefix khớp id
tests/sensors-engine.test.ts     # determinism (same seed ⇒ same sequence), scenario effects (co2 ramp, radiation spike, exercise HR), fault dropout/stuck/drift
tests/sensors-api.test.ts        # REST smoke: devices=38, sim start/status/stop, events list; tmp SKY_DB_PATH
```

Wiring: `server.ts` gọi `handleSensorsRequest(req)` sau events; `Bun.serve({ ..., websocket: wsHandlers })`; khi `/ws/telemetry` → `server.upgrade(req)`. Không đụng routes khác, không đụng apps/web, không đụng `change_events`.

## 10. Testing & verification

- `bun test` xanh (gồm tests mới) — chạy từ `apps/backend`.
- Registry test: 38 entries, unique `id`, `sourceUrl` non-empty + https, `simulated` đúng set §4.3, `namespace` prefix duy nhất/khớp.
- Engine test: determinism với seed cố định; `co2_accumulation` tăng co2_ppm; `radiation_event` dose_rate > 5 uSv/h trong window; `exercise` HR > 100 trong session; `sensor_fault dropout` tạo sequence gap & quality ≠ good; `stuck` giữ nguyên giá trị.
- API test: tmp `SKY_DB_PATH`; start → status running; events accumulate; stop; reset xoá.
- Không cần frontend chạy thử; WS verify bằng `wscat`-style script hoặc bun test WebSocket client (tuỳ agent).

## 11. Tương lai (không làm trong bản này)

- Publish `hazard.detected`/`health.fact.updated` lên `change_events` khi radiation/CO₂ vượt ngưỡng — cần policy xác nhận, để phase sau. **(đã làm ở v2 cho `health.fact.updated` dẫn xuất — xem §14; `hazard.detected` vẫn chưa publish từ sim.)**
- Replay adapter đọc OSDR/EDA subsets (gắn `dataset_id`).
- Asset store cho ECG/ultrasound/OCT (`asset_id`, §4.5).
- Retention policy cho `telemetry_events` (demo giữ hết; production cần TTL). **(đã làm ở v2 — §14.6.)**
- AuthZ theo crew cho `crew_id`-scoped events.
- Hiển thị SIMULATED trên apps/web — **ngoài scope hiện tại**.

## 12. Disclaimer (hiển thị ở mọi nơi surface data này)

> **Synthetic / simulated medical & environmental data.** Not a measurement from any real spacecraft, not operational alarm thresholds, and not medical guidance. AI-generated interpretation (nếu có) không thay thế bác sĩ; mọi hành động y khoa cần người xác nhận.

## 13. Nguồn cho các giá trị tham chiếu trong §6.2

Baselines là **simulator tuning**; nơi đối chiếu (không phải ngưỡng lâm sàng):

- HR/SpO₂/RR khi nghỉ & khi vận động, HRV: [NASA HRP Evidence Reports](https://humanresearchroadmap.nasa.gov/evidencereports); [CSA Bio-Monitor](https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp).
- Cabin O₂/CO₂/pressure habitability: [NASA-STD-3001 Vol 2](https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02); [NASA SMA — ISS Environmental Health](https://sma.nasa.gov/); CO₂ time series: [OSDR EDA](https://visualization.osdr.nasa.gov/eda/).
- Bức xạ (dose rate, event): [NASA SRAG](https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm); neutron (CANS context): [CSA CANS](https://www.asc-csa.gc.ca/eng/iss/cans.asp); radiation data: [OSDR](https://science.nasa.gov/biological-physical/data/osdr/).
- Tim khi vi trọng lực (LV volume/pressure): [Circulation 2026](https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665).
- Exercise trên ISS (T2, CEVIS, ARED): [NTRS](https://ntrs.nasa.gov/).
- Body mass measurement, EveryWear, T-Mini, thiết bị JAXA: [JAXA HST](https://humans-in-space.jaxa.jp/) · [ESA](https://www.esa.int/).

All URLs checked 2026-11-14. Simulator numbers are illustrative and **must not** be presented as clinical thresholds in UI or code comments.

## 14. Continuous runtime (v2) — 2026-11-16

v1 (§6, §8, §11) chỉ chạy khi có `POST /api/sensors/sim/start`: production luôn
`{"running":false}` và `telemetry_events` rỗng, health layer đứng yên ở seed 35 ngày. v2 làm
simulator chạy 24/7 với state bền, chiếu dữ liệu sang health live, phát hiện bất thường
deterministic và publish **facts dẫn xuất** (không bao giờ raw readings) lên bus `change_events`.

Code: `apps/backend/src/sensors/runtime.ts`, `src/sensors/retention.ts`,
`src/health/projector.ts`, `src/health/rules.ts`, `src/db/repositories/simSessions.ts`,
`src/db/repositories/healthLive.ts`.

### 14.1 Divergence from v1

| Chủ đề | v1 | v2 |
|---|---|---|
| Vòng đời sim | chỉ chạy khi gọi REST | autostart mission `SIM-001` khi `SKY_SIM_AUTOSTART=1`; không set = hành vi v1 |
| State | in-memory, mất khi restart | bảng `sim_sessions` (checkpoint 60 tick / stop / scenario change), restore khi boot |
| Health | `health_observations` seed 35 ngày (tĩnh) | thêm `health_current` + `health_rollups` (live, scope `MISSION` cho metric cabin) |
| Bus | không publish gì | `health.fact.updated` (topic có sẵn) từ rules deterministic, `source = "simulation"` |
| `change_events` | chỉ clinical/claims/agent | thêm facts dẫn xuất, đã hysteresis + dedupe + cooldown + rate-limit |
| Tốc độ | `speed` chỉ đổi nhịp timer | speed ≥ 10: advance model `speed` bước/tick wall nhưng **chỉ persist frame cuối** |
| Retention | giữ hết | `SKY_TELEMETRY_RETENTION_DAYS` (3) + `SKY_TELEMETRY_MAX_ROWS` (1.5M), prune boot + mỗi giờ |
| Auth | mở | endpoint mutating của sim cần `x-admin-key` **khi** env `SKY_SENSORS_ADMIN_KEY`/`SKY_ADMIN_KEY` set |
| Scenario | chỉ lúc start | `POST /api/sensors/sim/scenario` đổi giữa phiên, envelope đếm lại từ 0 |

### 14.2 Autostart + durable session

- `bootSimulation()` chạy trong `server.ts` **sau** seed astronaut/health, **trước** `Bun.serve`.
  Một producer duy nhất: engine đã chạy ⇒ chỉ gắn hook, không start lần hai.
- `SKY_SIM_AUTOSTART !== "1"` ⇒ log `[sim] autostart disabled` và không làm gì (hành vi v1).
- `sim_sessions` (connection SENSORS, PK `mission_id`): `run_id`, `scenario`, `speed`, `seed`,
  `status` (`running|paused|stopped`), `started_at_ms`, `sim_time_ms`, `tick_index`,
  `scenario_tick`, `sequences`, `crew_state`, `mission_state`, `rng_state`, `updated_at`.
  `scenario_tick` là cột thêm so với state engine gốc — cần cho envelope của scenario switch (§14.7).
- Checkpoint: mỗi 60 tick, khi stop, khi scenario change; một UPSERT (một transaction); lỗi chỉ
  log `[sim] checkpoint failed`, không bao giờ làm chết sim.
- Restore khi boot nếu status `running` hoặc `paused` (SIGINT/SIGTERM checkpoint `paused` trước khi
  stop). Status `stopped` (stop qua REST) **không** restore — boot sẽ start mission mới.
- `SimulationEngine.exportState()/restoreState()` chứa cả `rng.a` (mulberry32) và gaussian spare:
  restore rồi tick tiếp cho ra **đúng** chuỗi event như engine không gián đoạn (test:
  `tests/sensors-runtime.test.ts`, `tests/sensors-fast-forward.test.ts`).

### 14.3 Health live projection (PR2)

- `src/health/projector.ts` subscribe `telemetryBus:"telemetry_batch"` (frame **đã persist** của
  engine — không phải stream 1 Hz thô) → map payload → metric → UPSERT `health_current` +
  aggregate `health_rollups` 1 phút. 1 giờ tính on-the-fly từ 1 phút (`hourlyFromMinute`).
- Mapping: `heart_rate_bpm` ← biomonitor · `spo2_pct` ← pulse-oximeter · `respiratory_rate_bpm` ←
  respiratory-assessment · `core_temperature_c` ← thermo-mini · `skin_temperature_c` ← biomonitor
  (thermo-mini chỉ có core temp) · `systolic_mmhg`/`diastolic_mmhg` ← bp-ecg · `activity_counts` ←
  biomonitor · `dose_rate_uSv_h` ← cad · `co2_ppm`/`o2_pct`/`temperature_c`/`humidity_pct`/
  `pressure_kpa` ← env sensors (scope `MISSION`) · `power_w`/`cadence_rpm`/`elapsed_s` ← ergometer.
- `hrv_ms` **không có nguồn** trong telemetry ⇒ không bao giờ fabricate; endpoint live đơn giản
  không trả metric đó.
- Quality: telemetry `invalid` bị loại khỏi `health_current`/rollup; `suspect` giữ nhãn `suspect`
  (`quality_worst` của rollup chỉ xấu đi, không tốt lên).
- `health_observations` (seed 35 ngày) **không** bị coi là live: live state chỉ nằm ở 2 bảng mới.

### 14.4 Derived facts (PR4)

- `src/health/rules.ts` chạy trên cửa sổ trượt 10 phút **sim time**: 5 rule deterministic với
  hysteresis, episode `active → resolved`, dedupe khi đang active, cooldown 10 phút sim sau resolve,
  rate-limit 1 publish / rule / subject / 3 phút **wall**.

  | Rule | Fire | Clear |
  |---|---|---|
  | `cardiovascular_anomaly` | HR > median(window)+10 bpm, giữ ≥120 s (bỏ qua crew đang trong scenario exercise) | HR ≤ median+6, giữ 90 s |
  | `respiratory_distress` | RR > median+4 **hoặc** SpO₂ < 95, giữ ≥60 s | RR ≤ median+2 **và** SpO₂ ≥ 96, giữ 90 s |
  | `radiation_burst` | dose > 3× median **và** > 2 µSv/h, giữ ≥60 s | < 1.5× median, giữ 90 s |
  | `environment_co2_elevated` | CO₂ > 2000 ppm, giữ ≥120 s | < 1700 ppm, giữ 120 s |
  | `environment_o2_low` | O₂ < 19.5 %, giữ ≥120 s | ≥ 20.0 %, giữ 120 s |

  Mọi con số là **illustrative simulator tuning** (không phải ngưỡng lâm sàng). Severity mặc định
  `yellow`; `red` chỉ cho `radiation_burst` ≥ 4× median hoặc O₂ < 18.5 %. Fact mang worst quality
  của supporting window; window chứa `invalid` ⇒ không publish.
- Publish: `change_events` topic `health.fact.updated`, `source = "simulation"`, astronaut-scoped
  khi rule thuộc crew, `astronaut_id = NULL` khi mission-scoped (CO₂/O₂/radiation). Payload:

  ```ts
  { factId, missionId, crewId?, category: "cardiovascular"|"respiratory"|"radiation"|"environment",
    rule, status: "active"|"resolved", severity: "info"|"yellow"|"red",
    sourceMode: "synthetic", quality: "valid"|"suspect"|"invalid", observedAt, evidenceEventIds }
  ```

  `evidenceEventIds` tối đa 8 event id — **không** mang payload thô, không mang giá trị đọc được.
  Backend vẫn chấp nhận payload legacy `{fact, value, unit?, severity?}` của các publisher khác.
  Agent đọc facts qua `GET /api/events` (SHARED CONTEXT, HARNESSING §3.5).
- Auto-resolve: sau clear-hold, hoặc khi cửa sổ 10 phút không còn sample hỗ trợ.

### 14.5 Fast-forward (model time ≠ emission)

Ở `speed >= 10`, mỗi wall tick advance model `speed` bước (cumulative dose, exercise elapsed,
integrator env cộng đủ mọi bước) nhưng **chỉ persist + broadcast frame cuối**; validation
envelope/payload chỉ chạy cho frame được persist. Hệ quả: `telemetry_events` tăng theo wall second
(không ×100), health/rules thấy frame 1 Hz thật, và tổng liều tích lũy ở 100× **bằng** chạy 1×
(test `tests/sensors-fast-forward.test.ts`). Ở `1×` hành vi giữ nguyên như v1.

### 14.6 Retention (PR5)

`pruneTelemetry()` chạy lúc boot + mỗi giờ: xoá `received_at < now − SKY_TELEMETRY_RETENTION_DAYS`
(default 3), rồi nếu vẫn vượt `SKY_TELEMETRY_MAX_ROWS` (default 1_500_000) thì xoá row cũ nhất.
Batch ≤ 50k row/statement trong một transaction; log `[telemetry] pruned N rows` khi có xoá.

### 14.7 Scenario switch giữa phiên (PR5)

`POST /api/sensors/sim/scenario { scenario, crewId? }` (admin-gated, 409 `not_running` nếu sim tắt):
giữ nguyên HR walk, mission env và RNG draw của `radiation_event`; chỉ reset **envelope** scenario
vì các envelope dùng `tickIndex − scenarioTick` (`scenarioTick = tickIndex` tại thời điểm switch).
`crewId` đổi target của `exercise`/`anomaly_symptom`. Response `{ ok, scenario, simTimeMs }`.
Switch sang `sensor_fault` không kèm fault config ⇒ áp dropout mặc định `p=0.3` trên biomonitor (§6.3).

### 14.8 API bổ sung

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/health/live` | mảng 6 crew `{ ok, astronautId, live, updatedAt, source, metrics }` |
| GET | `/api/health/live/:astronautId` | `{ ok, live, updatedAt, source: "sim"\|"seed"\|"none", metrics }` |
| POST | `/api/sensors/sim/scenario` | đổi scenario giữa phiên (admin-gated như start/stop/reset) |

`live: true` chỉ khi simulator đang chạy **và** `health_current` của astronaut được ingest trong
~10 giây wall gần nhất. `source: "seed"` = chưa có live nhưng có `health_observations` lịch sử
(trả kèm `live: false`), `"none"` = chưa có gì. `GET /api/health/performance/:astronautId` thêm
object `live` cùng shape (additive).

### 14.9 Env (v2)

| Env | Default | Ý nghĩa |
|---|---|---|
| `SKY_SIM_AUTOSTART` | unset | `1` = autostart mission `SIM-001` lúc boot |
| `SKY_SENSORS_ADMIN_KEY` | unset | key cho `x-admin-key` của endpoint mutating sim; fallback `SKY_ADMIN_KEY`; unset cả hai = mở (local dev) |
| `SKY_TELEMETRY_RETENTION_DAYS` | `3` | TTL của `telemetry_events` |
| `SKY_TELEMETRY_MAX_ROWS` | `1500000` | trần số row giữ lại |

### 14.10 Giới hạn đã biết

- 100× vẫn CPU-bound (mỗi wall tick ≈ 100 bước model); throughput thực tế thấp hơn 100× khi máy yếu.
- Rules đánh giá theo **frame được persist**: ở speed ≥ 10, granularity là ~1 wall giây = `speed`
  giây sim, nên "sustained ≥120 s" được kiểm tra trên mốc thời gian sim của các frame, không phải
  từng giây sim.
- Chưa có endpoint rollup 1 giờ (repo `hourlyFromMinute` sẵn sàng cho UI/agent sau).
- Fact dùng payload v2; web mirror (`apps/web/src/features/agent/broadcast/model/events.ts`) phải
  chấp nhận shape v2 thì facts mới vào SHARED CONTEXT — việc đó thuộc task web song song.
