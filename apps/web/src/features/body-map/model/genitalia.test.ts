import { describe, it, expect } from "vitest";
import {
  HIDDEN_GENITALIA_MESHES,
  PUBIS_MESHES,
  PUBIS_REGION,
  flattenPubis,
  isPubisMesh,
  pubisWeight,
  shouldHidePenis,
} from "./genitalia";

describe("hidden genital meshes", () => {
  it("hides the genital mesh that the real GLB ships", () => {
    // Mesh names verified in public/models/anatomy-male.glb (2026-11-15).
    expect(shouldHidePenis("reproductive")).toBe(true);
  });

  it("keeps the neighbouring structures visible", () => {
    for (const name of [
      "skin_1",
      "skin",
      "pelvis",
      "pelvic_floor",
      "prostate",
      "bladder",
      "gluteal_l",
      "gluteal_r",
      "femur_l",
      "small_intestine",
      "colon",
    ]) {
      expect(shouldHidePenis(name)).toBe(false);
    }
  });

  it("does not hide unknown or empty names", () => {
    expect(shouldHidePenis("")).toBe(false);
    expect(shouldHidePenis("   ")).toBe(false);
    expect(shouldHidePenis("not_a_mesh")).toBe(false);
  });

  it("normalises case, spaces and dashes", () => {
    expect(shouldHidePenis("  REPRODUCTIVE  ")).toBe(true);
    expect(shouldHidePenis("Reproductive")).toBe(true);
    expect(shouldHidePenis("reproductive ")).toBe(true);
  });

  it("publishes frozen tables", () => {
    expect(Object.isFrozen(HIDDEN_GENITALIA_MESHES)).toBe(true);
    expect(Object.isFrozen(PUBIS_MESHES)).toBe(true);
    expect(Object.isFrozen(PUBIS_REGION)).toBe(true);
    expect([...HIDDEN_GENITALIA_MESHES]).toEqual(["reproductive"]);
  });
});

describe("pubic flatten", () => {
  it("only reshapes the skin meshes", () => {
    expect(isPubisMesh("skin_1")).toBe(true);
    expect(isPubisMesh("skin")).toBe(true);
    expect(isPubisMesh("reproductive")).toBe(false);
    expect(isPubisMesh("pelvis")).toBe(false);
    expect(isPubisMesh("")).toBe(false);
  });

  it("presses the penis tip back onto the pubic plane", () => {
    // Forward-most skin vertex around the pubis in the real GLB.
    const tip: [number, number, number] = [0.0, 0.8124, 0.1049];
    const [x, y, z] = flattenPubis(tip);
    expect(x).toBeCloseTo(tip[0], 6);
    expect(y).toBeCloseTo(tip[1], 6);
    expect(z).toBeLessThanOrEqual(PUBIS_REGION.plane + 1e-9);
    expect(tip[2] - z).toBeGreaterThan(0.05);
  });

  it("leaves the rest of the body untouched", () => {
    const knee: [number, number, number] = [0, 0.45, 0.05];
    const chest: [number, number, number] = [0, 1.2, 0.1];
    const hip: [number, number, number] = [0.12, 0.82, 0.03];
    expect(flattenPubis(knee)).toEqual(knee);
    expect(flattenPubis(chest)).toEqual(chest);
    expect(flattenPubis(hip)).toEqual(hip);
  });

  it("never pushes geometry forwards or dents the body behind the plane", () => {
    const behind: [number, number, number] = [0, 0.815, 0.02];
    expect(flattenPubis(behind)).toEqual(behind);
    const [x, y, z] = flattenPubis([0, 0.815, 0.06]);
    expect(x).toBe(0);
    expect(y).toBe(0.815);
    expect(z).toBeLessThan(0.06);
    expect(z).toBeGreaterThanOrEqual(PUBIS_REGION.plane - 1e-9);
  });

  it("weights the region from full strength to nothing", () => {
    const [cx, cy, cz] = PUBIS_REGION.center;
    expect(pubisWeight(cx, cy, cz)).toBe(1);
    const [rx, ry, rz] = PUBIS_REGION.radii;
    expect(pubisWeight(cx + rx, cy, cz)).toBeCloseTo(0, 12);
    expect(pubisWeight(cx, cy + ry, cz)).toBeCloseTo(0, 12);
    expect(pubisWeight(cx, cy, cz + rz)).toBeCloseTo(0, 12);
    expect(pubisWeight(0, 0, 0)).toBe(0);
  });
});
