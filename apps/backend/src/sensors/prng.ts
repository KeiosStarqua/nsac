// PRNG seeded cho simulator — deterministic-first (SENSOR_SIMULATION_SPEC §6.1).
// Cùng seed string ⇒ cùng chuỗi events. Không dùng Math.random ở bất cứ đâu trong engine.

/** Hash string → uint32 (xfnv-1a) để làm seed cho mulberry32. */
export function seedFromString(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * PRNG trạng thái exportable: `state()` trả uint32 `a` hiện tại, `setState(a)` khôi phục.
 * Restore = mulberry32(state) cho ra ĐÚNG chuỗi tiếp theo — cần cho durable session (§6.4 v2).
 */
export interface SeededRng {
  (): number;
  state(): number;
  setState(next: number): void;
}

/** mulberry32 — PRNG nhanh, đủ cho synthetic telemetry (không phải mục đích mật mã). */
export function mulberry32(seed: number): SeededRng {
  let a = seed >>> 0;
  const rng = (() => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as SeededRng;
  rng.state = () => a >>> 0;
  rng.setState = (next: number) => {
    a = next >>> 0;
  };
  return rng;
}

/** Gaussian có spare exportable — spare phải persist cùng `a`, nếu không chuỗi lệch 1 draw. */
export interface GaussianFn {
  (): number;
  spare(): number | null;
  setSpare(value: number | null): void;
}

/**
 * Gaussian (Box–Muller) gói quanh một rng đã seed.
 * Số spare được cache trong closure — cùng chuỗi lời gọi ⇒ cùng chuỗi kết quả, deterministic.
 */
export function makeGaussian(rng: () => number): GaussianFn {
  let spare: number | null = null;
  const gauss = (() => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    // u1 ∈ (0, 1] để tránh log(0).
    const u1 = 1 - rng();
    const u2 = rng();
    const radius = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    spare = radius * Math.sin(theta);
    return radius * Math.cos(theta);
  }) as GaussianFn;
  gauss.spare = () => spare;
  gauss.setSpare = (value: number | null) => {
    spare = value;
  };
  return gauss;
}
