import { describe, expect, it } from "vitest";
import { makeWave } from "./VoiceWaveform";

describe("makeWave", () => {
  it("produces a valid path with 152 line points", () => {
    const d = makeWave(0.6, 0.08, "idle");
    expect(d.startsWith("M")).toBe(true);
    expect((d.match(/L/g) ?? []).length).toBe(150);
  });
  it("idle amplitude stays tiny around the centerline", () => {
    const d = makeWave(0.6, 0.08, "idle");
    const ys = d.split(/[ML]/).filter(Boolean).map((seg) => Number(seg.split(",")[1]));
    expect(Math.max(...ys)).toBeLessThan(48);
    expect(Math.min(...ys)).toBeGreaterThan(22);
  });
  it("listening amplitude can be much taller than idle", () => {
    const listening = makeWave(0.6, 0.7, "listening");
    const ys = listening.split(/[ML]/).filter(Boolean).map((seg) => Number(seg.split(",")[1]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(10);
  });
});
