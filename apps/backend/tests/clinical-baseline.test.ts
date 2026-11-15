import { describe, expect, test } from "bun:test";
import { ewmaSlopePerMinute, mad, median, robustZScores, ewma } from "../src/clinical/baseline";

describe("median / mad", () => {
  test("median odd and even counts", () => {
    expect(median([1, 5, 3])).toBe(3);
    expect(median([1, 2, 4, 9])).toBe(3);
  });

  test("median throws on empty", () => {
    expect(() => median([])).toThrow();
  });

  test("MAD known values (Leys et al. 2013)", () => {
    // median = 2; deviations = [1,1,0,0,2,4,7]; median of deviations = 1
    expect(mad([1, 1, 2, 2, 4, 6, 9])).toBe(1);
    // constant array → MAD 0
    expect(mad([68, 68, 68, 68])).toBe(0);
  });
});

describe("robustZScores", () => {
  test("MAD==0 with constant values → degenerate, z NaN (not green)", () => {
    const result = robustZScores(Array(25).fill(68));
    expect(result.method).toBe("degenerate");
    expect(result.z.every(Number.isNaN)).toBe(true);
  });

  test("MAD==0 with a step jump → EWMA-residual fallback, finite z", () => {
    const values = [...Array(20).fill(68), ...Array(5).fill(85)];
    const result = robustZScores(values);
    expect(result.method).toBe("ewma-residual");
    expect(result.mad).toBe(0);
    expect(result.z.every(Number.isFinite)).toBe(true);
    // residuals grow during the jump — z of the jump samples clearly positive
    expect(Math.abs(result.z[result.z.length - 1])).toBeGreaterThan(1);
  });

  test("MAD>0 path: normal cyclic window yields small |z|", () => {
    const values: number[] = [];
    for (let i = 0; i < 60; i++) values.push([64, 68, 72][i % 3]);
    const result = robustZScores(values);
    expect(result.method).toBe("mad");
    expect(result.median).toBe(68);
    expect(result.mad).toBe(4);
    expect(Math.max(...result.z.map(Math.abs))).toBeLessThan(1);
  });
});

describe("ewma / ewmaSlopePerMinute", () => {
  test("ewma applies alpha recursively from first value", () => {
    const series = ewma([10, 20, 20], 0.5);
    expect(series[0]).toBe(10);
    expect(series[1]).toBe(15);
    expect(series[2]).toBe(17.5);
  });

  test("slope sign: rising series → positive, falling → negative", () => {
    const t = Array.from({ length: 20 }, (_, i) => i * 60_000); // 1 sample/min
    const rising = t.map((_, i) => 60 + i);
    const falling = t.map((_, i) => 80 - i);
    expect(ewmaSlopePerMinute(rising, t, 20)).toBeGreaterThan(0);
    expect(ewmaSlopePerMinute(falling, t, 20)).toBeLessThan(0);
    // flat series → ~0
    expect(Math.abs(ewmaSlopePerMinute(Array(20).fill(68), t, 20))).toBeLessThan(1e-9);
  });
});
