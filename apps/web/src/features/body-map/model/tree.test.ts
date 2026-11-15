import { describe, it, expect } from "vitest";
import { ANATOMY_STRUCTURES, SYSTEMS, SYSTEM_LABELS } from "open-anatomy-3d";
import { treeBySystem } from "./tree";

describe("treeBySystem", () => {
  it("groups all 147 catalog structures across the 7 systems, in SYSTEMS order", () => {
    const groups = treeBySystem();
    expect(groups.map((group) => group.system)).toEqual([...SYSTEMS]);
    expect(groups).toHaveLength(7);
    const total = groups.reduce((sum, group) => sum + group.items.length, 0);
    expect(total).toBe(147);
    for (const group of groups) {
      expect(group.systemLabel).toBe(SYSTEM_LABELS[group.system]);
    }
  });

  it("keeps the catalog order stable within each system", () => {
    const groups = treeBySystem();
    for (const group of groups) {
      const catalogOrder = ANATOMY_STRUCTURES.filter((s) => s.system === group.system).map((s) => s.key);
      expect(group.items.map((item) => item.key)).toEqual(catalogOrder);
    }
  });

  it("has no duplicate keys, within or across systems", () => {
    const keys = treeBySystem().flatMap((group) => group.items.map((item) => item.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("marks simulated only for the keys with a HUD reading (heart, lung_l, lung_r, brain)", () => {
    const simulated = treeBySystem()
      .flatMap((group) => group.items)
      .filter((item) => item.simulated)
      .map((item) => item.key);
    expect([...simulated].sort()).toEqual(["brain", "heart", "lung_l", "lung_r"]);
  });

  it("carries every field the tree renders (label, category, colour)", () => {
    for (const group of treeBySystem()) {
      for (const item of group.items) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.category.length).toBeGreaterThan(0);
        expect(item.color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
