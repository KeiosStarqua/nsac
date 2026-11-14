// Device Registry — 38 thiết bị/hệ thống theo SENSOR_SIMULATION_SPEC §4.3.
// Single source of truth trong code (không phải DB): tránh lệch giữa DB và code khi demo.
// `flightStatus` là trạng thái thực ngoài đời, `simulated` là Sky có mô phỏng hay không — trực giao nhau.
// Mọi `sourceUrl` đã được check 2026-11-14 (SPEC §2). KHÔNG phải cam kết thiết bị có trên mọi tàu.

export type FlightStatus =
  | "iss_operational"
  | "iss_tested"
  | "iss_research"
  | "nasa_evaluated"
  | "development";

export interface DeviceDef {
  id: string;
  name: string;
  organization: string;
  flightStatus: FlightStatus;
  /** Sky namespace(s), SPEC §4.3 — chuỗi dotted, vd. "cardiovascular.bp". Nhiều namespace ngăn cách " · " trong SPEC. */
  namespaces: string[];
  simulated: boolean;
  sourceUrl: string;
  /** 1–2 câu mô tả; không claim y khoa. */
  description: string;
  /** Vị trí mặc định hư cấu (SPEC §4.3). */
  locationId: string;
}

const CREW = "HAB-01";
const CABIN = "NOD3";
const CANS_LOC = "CANS-LOC";

export const DEVICES: DeviceDef[] = [
  { id: "biomonitor", name: "Bio-Monitor / AstroSkin", organization: "CSA", flightStatus: "iss_operational", namespaces: ["biomonitor.*"], simulated: true, sourceUrl: "https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp", description: "CSA wearable đo HR, SpO₂, hô hấp, nhiệt da và activity counts trên ISS.", locationId: CREW },
  { id: "everywear", name: "ESA EveryWear (smartshirt + patches)", organization: "ESA / CNES", flightStatus: "iss_tested", namespaces: ["everywear.*"], simulated: false, sourceUrl: "https://www.esa.int/", description: "ESA smartshirt + patches đo HR, steps, nhiệt da, vascular index; đã thử nghiệm trên ISS.", locationId: CREW },
  { id: "thermo-mini", name: "Thermo-Mini / T-Mini (core temp est.)", organization: "ESA", flightStatus: "iss_research", namespaces: ["thermoregulation.core_temperature_c"], simulated: true, sourceUrl: "https://www.esa.int/", description: "ESA thiết bị research ước lượng nhiệt độ lõi từ nhiệt da.", locationId: CREW },
  { id: "bp-ecg", name: "Blood Pressure / ECG Monitor", organization: "NASA / JAXA", flightStatus: "iss_operational", namespaces: ["cardiovascular.bp", "cardiovascular.ecg"], simulated: true, sourceUrl: "https://humans-in-space.jaxa.jp/", description: "Đo huyết áp + ECG định kỳ trên ISS; Sky sim chỉ đo BP/HR theo phiên.", locationId: CREW },
  { id: "ultrasound", name: "Diagnostic Ultrasound", organization: "NASA / JAXA", flightStatus: "iss_operational", namespaces: ["imaging.ultrasound"], simulated: false, sourceUrl: "https://ntrs.nasa.gov/", description: "Siêu âm chẩn đoán đa mục đích trên ISS; imaging không sim trong bản này (asset pattern §4.4).", locationId: CREW },
  { id: "pulse-oximeter", name: "Pulse Oximeter", organization: "NASA / JAXA", flightStatus: "iss_operational", namespaces: ["cardiovascular.spo2"], simulated: true, sourceUrl: "https://humans-in-space.jaxa.jp/", description: "Đo SpO₂ và mạch đeo ngón tay trên ISS.", locationId: CREW },
  { id: "respiratory-assessment", name: "Respiratory Assessment", organization: "NASA", flightStatus: "iss_operational", namespaces: ["respiratory.*"], simulated: true, sourceUrl: "https://humanresearchroadmap.nasa.gov/evidencereports", description: "Đánh giá nhịp thở, tidal volume, minute ventilation.", locationId: CREW },
  { id: "urine-analyzer", name: "Urine Analyzer", organization: "NASA / JAXA", flightStatus: "iss_operational", namespaces: ["lab.urine"], simulated: false, sourceUrl: "https://ntrs.nasa.gov/", description: "Phân tích nước tiểu tại chỗ (pH, specific gravity, glucose, protein).", locationId: CREW },
  { id: "blood-analyzer", name: "Blood Sampling / Analyzer", organization: "NASA", flightStatus: "iss_operational", namespaces: ["lab.blood"], simulated: false, sourceUrl: "https://ntrs.nasa.gov/", description: "Lấy mẫu và phân tích máu tại chỗ (hemoglobin, hematocrit, biomarkers).", locationId: CREW },
  { id: "tempus", name: "Tempus ALS / Pro", organization: "NASA (evaluated)", flightStatus: "nasa_evaluated", namespaces: ["tempus.*"], simulated: false, sourceUrl: "https://ntrs.nasa.gov/", description: "Thiết bị đo đa thông số NASA đánh giá; chưa phải thiết bị vận hành chuẩn.", locationId: CREW },
  { id: "oct", name: "OCT / Ocular Examination (SANS)", organization: "NASA", flightStatus: "iss_research", namespaces: ["ocular.oct"], simulated: false, sourceUrl: "https://humanresearchroadmap.nasa.gov/evidencereports", description: "Optical coherence tomography nghiên cứu SANS (spaceflight associated neuro-ocular syndrome).", locationId: CREW },
  { id: "defibrillator", name: "Medical Defibrillator", organization: "NASA", flightStatus: "iss_operational", namespaces: ["emergency.defibrillator"], simulated: false, sourceUrl: "https://ntrs.nasa.gov/", description: "Máy khử rung cấp cứu trên ISS.", locationId: CREW },
  { id: "cad", name: "Crew Active Dosimeter (CAD)", organization: "NASA", flightStatus: "iss_operational", namespaces: ["radiation.personal_dose", "radiation.dose_rate"], simulated: true, sourceUrl: "https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm", description: "Dosimeter cá nhân đo dose rate thời gian thực và liều tích lũy.", locationId: CREW },
  { id: "tepc", name: "Tissue Equivalent Proportional Counter", organization: "NASA", flightStatus: "iss_operational", namespaces: ["radiation.absorbed_dose", "radiation.spectrum"], simulated: false, sourceUrl: "https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm", description: "Đo absorbed dose rate và phổ năng lượng bằng đầu dò tissue-equivalent.", locationId: CABIN },
  { id: "ram", name: "Radiation Area Monitor (RAM)", organization: "NASA", flightStatus: "iss_operational", namespaces: ["radiation.area"], simulated: false, sourceUrl: "https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm", description: "Giám sát bức xạ khu vực, liều tích lũy theo vị trí.", locationId: CABIN },
  { id: "cpds", name: "Charged Particle Directional Spectrometer", organization: "NASA", flightStatus: "iss_research", namespaces: ["radiation.particle_flux"], simulated: false, sourceUrl: "https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm", description: "Đo flux hạt mang điện theo hướng x/y/z và bin năng lượng.", locationId: CABIN },
  { id: "passive-dosimeter", name: "Crew Passive Dosimeter", organization: "NASA", flightStatus: "iss_operational", namespaces: ["radiation.passive_dose"], simulated: false, sourceUrl: "https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm", description: "Dosimeter thụ động — chỉ có kết quả sau khi lab đọc.", locationId: CREW },
  { id: "hera-rad-rem2", name: "HERA / RAD / REM2", organization: "NASA", flightStatus: "iss_research", namespaces: ["radiation.environment"], simulated: false, sourceUrl: "https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm", description: "Cụm instruments nghiên cứu bức xạ môi trường (HERA, RAD, REM2).", locationId: CABIN },
  { id: "o2-analyzer", name: "Oxygen Analyzer", organization: "NASA (ISS EHS)", flightStatus: "iss_operational", namespaces: ["cabin.o2"], simulated: true, sourceUrl: "https://sma.nasa.gov/", description: "Đo nồng độ O₂ trong cabin (ISS Environmental Health).", locationId: CABIN },
  { id: "co2-analyzer", name: "CO₂ Analyzer", organization: "NASA (ISS EHS)", flightStatus: "iss_operational", namespaces: ["cabin.co2"], simulated: true, sourceUrl: "https://sma.nasa.gov/", description: "Đo nồng độ CO₂ trong cabin; ppm theo thể tích.", locationId: CABIN },
  { id: "pressure-sensor", name: "Cabin Pressure Sensor", organization: "NASA", flightStatus: "iss_operational", namespaces: ["cabin.pressure"], simulated: true, sourceUrl: "https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02", description: "Đo áp suất cabin theo habitable environment limits (NASA-STD-3001 Vol 2).", locationId: CABIN },
  { id: "temperature-sensor", name: "Cabin Temperature Sensor", organization: "NASA", flightStatus: "iss_operational", namespaces: ["cabin.temperature"], simulated: true, sourceUrl: "https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02", description: "Đo nhiệt độ cabin (habitable environment).", locationId: CABIN },
  { id: "humidity-sensor", name: "Humidity Sensor", organization: "NASA", flightStatus: "iss_operational", namespaces: ["cabin.humidity"], simulated: true, sourceUrl: "https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02", description: "Đo độ ẩm tương đối cabin (habitable environment).", locationId: CABIN },
  { id: "co-monitor", name: "CO Monitor", organization: "NASA (ISS EHS)", flightStatus: "iss_operational", namespaces: ["cabin.co"], simulated: false, sourceUrl: "https://sma.nasa.gov/", description: "Giám sát CO cabin (ISS Environmental Health).", locationId: CABIN },
  { id: "toxic-gas", name: "Toxic Gas Analyzer (HCl, HCN)", organization: "NASA (ISS EHS)", flightStatus: "iss_operational", namespaces: ["cabin.toxic_gas"], simulated: false, sourceUrl: "https://sma.nasa.gov/", description: "Phân tích khí độc HCl/HCN trong cabin.", locationId: CABIN },
  { id: "voc-analyzer", name: "Volatile Organic Analyzer", organization: "NASA (ISS EHS)", flightStatus: "iss_operational", namespaces: ["cabin.voc"], simulated: false, sourceUrl: "https://sma.nasa.gov/", description: "Phân tích VOC trong cabin (ISS Environmental Health).", locationId: CABIN },
  { id: "water-quality", name: "Water Quality Analyzer (TOC, pH, conductivity)", organization: "NASA (ISS EHS)", flightStatus: "iss_operational", namespaces: ["water.quality"], simulated: false, sourceUrl: "https://sma.nasa.gov/", description: "Kiểm tra chất lượng nước: TOC, pH, conductivity.", locationId: CABIN },
  { id: "microbial-sampler", name: "Microbial Air Sampler", organization: "NASA (ISS EHS)", flightStatus: "iss_operational", namespaces: ["air.microbial"], simulated: false, sourceUrl: "https://sma.nasa.gov/", description: "Lấy mẫu vi sinh không khí; kết quả trễ sau phân tích.", locationId: CABIN },
  { id: "sound-level", name: "Sound Level Meter", organization: "NASA", flightStatus: "iss_operational", namespaces: ["acoustic.spl"], simulated: false, sourceUrl: "https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02", description: "Đo mức âm thanh dBA và phổ tần số (acoustic limits NASA-STD-3001).", locationId: CABIN },
  { id: "audio-dosimeter", name: "Audio Dosimeter", organization: "NASA", flightStatus: "iss_operational", namespaces: ["acoustic.dose"], simulated: false, sourceUrl: "https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02", description: "Đo tích lũy phơi nhiễm tiếng ồn (noise dose %).", locationId: CREW },
  { id: "airflow", name: "Airflow / Ventilation Sensor (Sky extension)", organization: "NASA", flightStatus: "iss_operational", namespaces: ["cabin.airflow"], simulated: false, sourceUrl: "https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02", description: "Mở rộng Sky (không phải bộ cảm biến cố định trên ISS): đo lưu lượng gió + RPM quạt.", locationId: CABIN },
  { id: "particulate", name: "Particulate Monitor (Sky extension)", organization: "NASA", flightStatus: "iss_operational", namespaces: ["cabin.particulate"], simulated: false, sourceUrl: "https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02", description: "Mở rộng Sky: nồng độ hạt lơ lửng và bin kích thước.", locationId: CABIN },
  { id: "treadmill", name: "Treadmill (T2 / COLBERT)", organization: "NASA", flightStatus: "iss_operational", namespaces: ["exercise.treadmill"], simulated: false, sourceUrl: "https://ntrs.nasa.gov/", description: "Máy chạy bộ T2/COLBERT (vi trọng lực cần harness).", locationId: CABIN },
  { id: "ergometer", name: "Cycle Ergometer (CEVIS)", organization: "NASA", flightStatus: "iss_operational", namespaces: ["exercise.ergometer"], simulated: true, sourceUrl: "https://ntrs.nasa.gov/", description: "Xe đạp CEVIS — NASA cycling ergometer vibration-isolated.", locationId: CABIN },
  { id: "ared", name: "Advanced Resistive Exercise Device (ARED)", organization: "NASA", flightStatus: "iss_operational", namespaces: ["exercise.ared"], simulated: false, sourceUrl: "https://ntrs.nasa.gov/", description: "ARED — thiết bị tập kháng lực trên ISS.", locationId: CABIN },
  { id: "sleep-monitor", name: "Activity / Sleep Monitor", organization: "NASA", flightStatus: "iss_operational", namespaces: ["activity.sleep"], simulated: false, sourceUrl: "https://humanresearchroadmap.nasa.gov/evidencereports", description: "Theo dõi activity và chất lượng giấc ngủ qua actigraphy.", locationId: CREW },
  { id: "body-mass", name: "Body Mass Measurement", organization: "NASA", flightStatus: "iss_operational", namespaces: ["body.mass"], simulated: false, sourceUrl: "https://ntrs.nasa.gov/", description: "Đo khối lượng cơ thể trong vi trọng lực (SLAMMD/MAMS pattern).", locationId: CREW },
  { id: "cans", name: "Canadian Active Neutron Spectrometer (CANS)", organization: "CSA", flightStatus: "development", namespaces: ["radiation.neutron"], simulated: true, sourceUrl: "https://www.asc-csa.gc.ca/eng/iss/cans.asp", description: "CSA neutron spectrometer đang phát triển (đầu tư tiếp 2026-02); KHÔNG bay vận hành. Giá trị/bin do Sky định nghĩa.", locationId: CANS_LOC },
];

const byId = new Map(DEVICES.map((d) => [d.id, d]));

export function deviceById(id: string): DeviceDef | undefined {
  return byId.get(id);
}

/** device_type trong envelope = root segment của namespace đầu tiên (SPEC §4.1). */
export function deviceTypeOf(def: DeviceDef): string {
  return def.namespaces[0].split(".")[0];
}
