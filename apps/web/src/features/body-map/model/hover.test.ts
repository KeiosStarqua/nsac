import { describe, it, expect } from "vitest";
import {
  HOVER_MIN_STEP,
  pickStructureKey,
  shouldReportHover,
  tooltipPlacement,
  type HoverHit,
} from "./hover";

const VIEWPORT = { width: 1000, height: 800 };
const BOX = { width: 200, height: 42 };

function hit(name: string, visible = true): HoverHit {
  return { name, visible };
}

describe("hover picking", () => {
  it("names the catalog structure under the pointer", () => {
    expect(pickStructureKey([hit("heart")])).toBe("heart");
    expect(pickStructureKey([hit("lung_l"), hit("heart")])).toBe("lung_l");
  });

  it("maps the skin's mesh name to its catalog key", () => {
    expect(pickStructureKey([hit("skin_1")])).toBe("skin");
  });

  it("keeps the skin last, because the shell is in front of everything", () => {
    expect(pickStructureKey([hit("skin_1"), hit("heart")])).toBe("heart");
    expect(pickStructureKey([hit("skin_1"), hit("skin")])).toBe("skin");
  });

  it("skips a mesh the rail switched off", () => {
    expect(pickStructureKey([hit("lung_l", false), hit("heart")])).toBe("heart");
    expect(pickStructureKey([hit("heart", false)])).toBeNull();
  });

  it("never picks the genitalia mesh, whatever its visibility", () => {
    expect(pickStructureKey([hit("reproductive")])).toBeNull();
    expect(pickStructureKey([hit("reproductive"), hit("skin_1")])).toBe("skin");
  });

  it("picks a joint hotspot by its catalog key", () => {
    expect(pickStructureKey([hit("shoulder_l")])).toBe("shoulder_l");
  });

  it("ignores meshes that are not in the catalog", () => {
    expect(pickStructureKey([hit("mystery_mesh")])).toBeNull();
    expect(pickStructureKey([hit("mystery_mesh"), hit("femur_r")])).toBe("femur_r");
    expect(pickStructureKey([])).toBeNull();
  });
});

describe("hover reporting", () => {
  const heart = { key: "heart", x: 100, y: 100 };

  it("reports the first structure and the pointer leaving the body", () => {
    expect(shouldReportHover(null, heart)).toBe(true);
    expect(shouldReportHover(heart, null)).toBe(true);
    expect(shouldReportHover(null, null)).toBe(false);
  });

  it("reports a different structure even under the same pixel", () => {
    expect(shouldReportHover(heart, { ...heart, key: "lung_l" })).toBe(true);
  });

  it("holds still while the pointer shivers a pixel or two", () => {
    expect(shouldReportHover(heart, { ...heart, x: 102, y: 102 })).toBe(false);
    expect(shouldReportHover(heart, { ...heart, x: 100 + HOVER_MIN_STEP - 0.5, y: 100 })).toBe(false);
  });

  it("reports a step across the body", () => {
    expect(shouldReportHover(heart, { ...heart, x: 100 + HOVER_MIN_STEP, y: 100 })).toBe(true);
    expect(shouldReportHover(heart, { ...heart, x: 130, y: 140 })).toBe(true);
  });
});

describe("tooltip placement", () => {
  it("sits right and below the pointer with room to spare", () => {
    const placement = tooltipPlacement(100, 100, VIEWPORT, BOX);
    expect(placement).toEqual({ left: 114, top: 114, flippedX: false, flippedY: false });
  });

  it("flips to the left when the right edge is close", () => {
    const placement = tooltipPlacement(950, 100, VIEWPORT, BOX);
    expect(placement.flippedX).toBe(true);
    expect(placement.left).toBe(950 - 14 - BOX.width);
    expect(placement.top).toBe(114);
  });

  it("flips above when the bottom edge is close", () => {
    const placement = tooltipPlacement(100, 790, VIEWPORT, BOX);
    expect(placement.flippedY).toBe(true);
    expect(placement.top).toBe(790 - 14 - BOX.height);
    expect(placement.left).toBe(114);
  });

  it("stays inside a viewport smaller than the box", () => {
    const placement = tooltipPlacement(50, 50, { width: 100, height: 60 }, BOX);
    expect(placement.left).toBe(8);
    expect(placement.top).toBe(10); // 60 - 42 - 8, as low as it fits
  });

  it("never goes above or left of the margin", () => {
    const placement = tooltipPlacement(0, 0, VIEWPORT, BOX);
    expect(placement.left).toBe(14);
    expect(placement.top).toBe(14);
  });
});
