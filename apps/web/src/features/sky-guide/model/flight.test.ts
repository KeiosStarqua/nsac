import { describe, expect, it } from "vitest";
import { bezier, controlPoint, flightDurationMs, idlePoint, perchFor, pickStation } from "./flight";

const viewport = { width: 1280, height: 800 };
const box = (top: number, height = 120) => ({ top, bottom: top + height, left: 100, right: 820 });

describe("pickStation", () => {
  it("picks the station closest to the reading line", () => {
    const stations = [
      { id: "a", box: box(120) },
      { id: "b", box: box(320) },
      { id: "c", box: box(700) },
    ];
    expect(pickStation(stations, viewport)).toBe("b");
  });

  it("returns null when no station is in the middle band", () => {
    expect(pickStation([{ id: "a", box: box(-400) }, { id: "b", box: box(900) }], viewport)).toBeNull();
  });
});

describe("flight path", () => {
  const from = { x: 0, y: 400 };
  const to = { x: 600, y: 400 };

  it("starts and ends on its endpoints", () => {
    const control = controlPoint(from, to);
    expect(bezier(from, control, to, 0)).toEqual(from);
    expect(bezier(from, control, to, 1)).toEqual(to);
  });

  it("arcs upwards between them", () => {
    expect(bezier(from, controlPoint(from, to), to, 0.5).y).toBeLessThan(400);
  });

  it("keeps hops between 0.6 and 1.8 seconds", () => {
    expect(flightDurationMs(from, from)).toBe(600);
    expect(flightDurationMs(from, { x: 5000, y: 5000 })).toBe(1800);
  });
});

describe("perch and idle points", () => {
  it("perches on the station's top-right corner", () => {
    expect(perchFor(box(300), viewport, 88)).toEqual({ x: 820 - 66, y: 300 - 88 * 0.55 });
  });

  it("stays on screen and below the header", () => {
    const perch = perchFor({ top: 10, bottom: 100, left: 0, right: 5000 }, viewport, 88);
    expect(perch.x).toBeLessThanOrEqual(viewport.width - 88);
    expect(perch.y).toBeGreaterThanOrEqual(72);
    const idle = idlePoint(viewport, 88);
    expect(idle.x).toBeLessThan(viewport.width - 88);
  });
});
