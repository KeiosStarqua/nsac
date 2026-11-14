import { describe, expect, test } from "bun:test";
import { DEVICES, deviceById, deviceTypeOf } from "../src/sensors/registry";

// SPEC §4.3 — namespaces kỳ vọng theo đúng bảng SPEC (chuỗi dotted, nhiều namespace tách riêng).
const EXPECTED_NAMESPACES: Record<string, string[]> = {
  biomonitor: ["biomonitor.*"],
  everywear: ["everywear.*"],
  "thermo-mini": ["thermoregulation.core_temperature_c"],
  "bp-ecg": ["cardiovascular.bp", "cardiovascular.ecg"],
  ultrasound: ["imaging.ultrasound"],
  "pulse-oximeter": ["cardiovascular.spo2"],
  "respiratory-assessment": ["respiratory.*"],
  "urine-analyzer": ["lab.urine"],
  "blood-analyzer": ["lab.blood"],
  tempus: ["tempus.*"],
  oct: ["ocular.oct"],
  defibrillator: ["emergency.defibrillator"],
  cad: ["radiation.personal_dose", "radiation.dose_rate"],
  tepc: ["radiation.absorbed_dose", "radiation.spectrum"],
  ram: ["radiation.area"],
  cpds: ["radiation.particle_flux"],
  "passive-dosimeter": ["radiation.passive_dose"],
  "hera-rad-rem2": ["radiation.environment"],
  "o2-analyzer": ["cabin.o2"],
  "co2-analyzer": ["cabin.co2"],
  "pressure-sensor": ["cabin.pressure"],
  "temperature-sensor": ["cabin.temperature"],
  "humidity-sensor": ["cabin.humidity"],
  "co-monitor": ["cabin.co"],
  "toxic-gas": ["cabin.toxic_gas"],
  "voc-analyzer": ["cabin.voc"],
  "water-quality": ["water.quality"],
  "microbial-sampler": ["air.microbial"],
  "sound-level": ["acoustic.spl"],
  "audio-dosimeter": ["acoustic.dose"],
  airflow: ["cabin.airflow"],
  particulate: ["cabin.particulate"],
  treadmill: ["exercise.treadmill"],
  ergometer: ["exercise.ergometer"],
  ared: ["exercise.ared"],
  "sleep-monitor": ["activity.sleep"],
  "body-mass": ["body.mass"],
  cans: ["radiation.neutron"],
};

// SPEC §4.3 — cột SIM ✅. 13 registry rows ⇒ 12 streams (temperature-sensor + humidity-sensor chung cabin.climate).
const EXPECTED_SIMULATED = [
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
];

const FLIGHT_STATUSES = new Set(["iss_operational", "iss_tested", "iss_research", "nasa_evaluated", "development"]);

describe("sensor registry", () => {
  test("38 devices, unique ids", () => {
    expect(DEVICES.length).toBe(38);
    const ids = DEVICES.map((d) => d.id);
    expect(new Set(ids).size).toBe(38);
    expect(Object.keys(EXPECTED_NAMESPACES).length).toBe(38);
    expect(new Set(EXPECTED_SIMULATED).size).toBe(13);
  });

  test("every entry has an https sourceUrl", () => {
    for (const device of DEVICES) {
      expect(device.sourceUrl.startsWith("https://")).toBe(true);
    }
  });

  test("simulated ids exactly equal the SPEC §4.3 SIM set", () => {
    const simulated = DEVICES.filter((d) => d.simulated)
      .map((d) => d.id)
      .sort();
    expect(simulated).toEqual([...EXPECTED_SIMULATED].sort());
  });

  test("namespaces match SPEC §4.3 exactly (and are dotted)", () => {
    for (const device of DEVICES) {
      const expected = EXPECTED_NAMESPACES[device.id];
      expect(expected, `missing expected namespaces for ${device.id}`).toBeDefined();
      expect(device.namespaces).toEqual(expected);
      for (const ns of device.namespaces) {
        expect(ns.length).toBeGreaterThan(0);
        expect(ns.split(".").every((seg) => seg.length > 0)).toBe(true);
      }
    }
  });

  test("device_type = root segment of first namespace, non-empty", () => {
    for (const device of DEVICES) {
      expect(deviceTypeOf(device).length).toBeGreaterThan(0);
    }
  });

  test("flightStatus from the allowed enum; names/descriptions/locations present", () => {
    for (const device of DEVICES) {
      expect(FLIGHT_STATUSES.has(device.flightStatus)).toBe(true);
      expect(device.name.trim().length).toBeGreaterThan(0);
      expect(device.organization.trim().length).toBeGreaterThan(0);
      expect(device.description.trim().length).toBeGreaterThan(0);
      expect(device.locationId.trim().length).toBeGreaterThan(0);
    }
  });

  test("deviceById finds entries and misses unknown ids", () => {
    expect(deviceById("biomonitor")?.id).toBe("biomonitor");
    expect(deviceById("cans")?.flightStatus).toBe("development");
    expect(deviceById("not-a-device")).toBeUndefined();
  });
});
