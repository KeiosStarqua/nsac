import { describe, it, expect } from "vitest";
import {
  DEFAULT_LAYERS,
  LAYER_KEYS,
  atLeastOneLayer,
  layerLabel,
  meshNameForStructure,
  structureKeyForMesh,
  toggleLayer,
  type LayerState,
} from "./layers";
type LayerMap = LayerState;

const onlyOrgans: LayerState = {
  skin: false,
  skeleton: false,
  muscles: false,
  organs: true,
  vessels: false,
  nerves: false,
};

describe("layers", () => {
  it("shows one toggle per meshed body system", () => {
    expect(LAYER_KEYS).not.toContain("joints");
    expect(LAYER_KEYS.length).toBe(6);
  });

  it("labels every layer from the package", () => {
    for (const key of LAYER_KEYS) expect(layerLabel(key).trim().length).toBeGreaterThan(0);
    expect(layerLabel("organs")).toBe("Organs");
  });

  it("starts with every layer visible", () => {
    for (const key of LAYER_KEYS) expect(DEFAULT_LAYERS[key]).toBe(true);
    expect(atLeastOneLayer(DEFAULT_LAYERS)).toBe(true);
  });

  it("toggles a layer off and back on without mutating the input", () => {
    const off = toggleLayer(DEFAULT_LAYERS, "skin");
    expect(off.skin).toBe(false);
    expect(DEFAULT_LAYERS.skin).toBe(true);
    expect(toggleLayer(off, "skin").skin).toBe(true);
  });

  it("keeps at least one layer on", () => {
    expect(toggleLayer(onlyOrgans, "organs")).toBe(onlyOrgans);
    expect(atLeastOneLayer(toggleLayer(onlyOrgans, "organs"))).toBe(true);
    expect(atLeastOneLayer(onlyOrgans)).toBe(true);
  });
});

describe("mesh mapping", () => {
  it("maps glTF mesh names to catalog keys", () => {
    expect(structureKeyForMesh("heart")).toBe("heart");
    expect(structureKeyForMesh("lung_l")).toBe("lung_l");
    expect(structureKeyForMesh("skin_1")).toBe("skin");
    expect(structureKeyForMesh("not_a_mesh")).toBeNull();
  });

  it("maps catalog keys back to mesh names", () => {
    expect(meshNameForStructure("skin")).toBe("skin_1");
    expect(meshNameForStructure("brain")).toBe("brain");
  });
});
