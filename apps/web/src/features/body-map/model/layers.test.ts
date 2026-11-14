import { describe, it, expect } from "vitest";
import { toggleLayer, LAYER_KEYS, structureLabel } from "./layers";
import { ATTRIBUTION } from "open-anatomy-3d";

describe("layers", () => {
  it("keeps at least one layer on", () => {
    const layers = Object.fromEntries(LAYER_KEYS.map((k) => [k, k === "organs"])) as any;
    const next = toggleLayer(layers, "organs");
    expect(next.organs).toBe(true);
  });
  it("structureLabel fallback", () => {
    expect(structureLabel("definitely-not-a-key")).toBe("definitely-not-a-key");
  });
});

describe("attribution", () => {
  it("non-empty and mentions CC BY", () => {
    expect(ATTRIBUTION.length).toBeGreaterThan(0);
    expect(ATTRIBUTION).toMatch(/CC BY/);
  });
});

describe("framing", () => {
  it("finite distance", async () => {
    const { framingDistance, boxCenter } = await import("./framing");
    const box = { min: [-0.1, 0.9, -0.1] as [number, number, number], max: [0.1, 1.1, 0.1] as [number, number, number] };
    const d = framingDistance(box, 38);
    expect(Number.isFinite(d)).toBe(true);
    const c = boxCenter(box);
    expect(c.every((n) => Number.isFinite(n))).toBe(true);
  });
});