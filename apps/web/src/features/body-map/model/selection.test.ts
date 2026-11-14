import { describe, it, expect } from "vitest";
import { VITAL_VALUES } from "../../sky-hud/vitals";
import { structureDetails } from "./selection";

describe("structure selection", () => {
  it("describes a catalog structure", () => {
    const heart = structureDetails("heart");
    expect(heart.known).toBe(true);
    expect(heart.label).toBe("Heart");
    expect(heart.systemLabel).toBe("Organs");
    expect(heart.category).toBe("Cardiovascular");
    expect(heart.color).toBe("#b8352c");
  });

  it("takes heart, lung and brain readings from the fixture", () => {
    const heart = structureDetails("heart");
    expect(heart.vitals.map((row) => row.value)).toEqual([`${VITAL_VALUES.heartRate} bpm`]);

    for (const lungKey of ["lung_l", "lung_r"]) {
      const values = structureDetails(lungKey).vitals.map((row) => row.value);
      expect(values).toContain(`${VITAL_VALUES.respiration} br/min`);
      expect(values).toContain(`${VITAL_VALUES.spo2} %`);
    }

    const brain = structureDetails("brain");
    expect(brain.vitals.map((row) => row.value)).toEqual([
      `${VITAL_VALUES.sleepHours} h ${VITAL_VALUES.sleepMinutes} m`,
    ]);
  });

  it("has no reading for other structures", () => {
    expect(structureDetails("femur_r").vitals).toEqual([]);
    expect(structureDetails("skin").vitals).toEqual([]);
    expect(structureDetails("skin").systemLabel).toBe("Skin");
  });

  it("still names a mesh that is not in the catalog", () => {
    const unknown = structureDetails("mystery_mesh");
    expect(unknown.known).toBe(false);
    expect(unknown.label).toBe("Mystery mesh");
    expect(unknown.system).toBeNull();
    expect(unknown.vitals).toEqual([]);
  });
});
