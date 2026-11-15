import { describe, expect, test } from "bun:test";
import { assessHrQuality, parseHrSample, type TelemetrySampleInput } from "../src/clinical/quality";

const NOW = new Date("2026-11-16T12:00:00.000Z");

function row(value: number, minutesAgo: number, qualityStatus = "good", eventId?: string): TelemetrySampleInput {
  const observedAt = new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
  return {
    eventId: eventId ?? `ev-${minutesAgo}-${value}`,
    observedAt,
    qualityStatus,
    payload: JSON.stringify({ heart_rate_bpm: value }),
  };
}

function validWindow(count: number, qualityStatus = "good"): TelemetrySampleInput[] {
  // Newest sample at 1 minute ago; older samples further back.
  return Array.from({ length: count }, (_, i) => row(68 + (i % 3 === 0 ? 2 : i % 3 === 1 ? -2 : 0), i + 1, qualityStatus));
}

describe("quality gate", () => {
  test("all-valid window ≥ 12 samples passes", () => {
    const result = assessHrQuality(validWindow(12), NOW);
    expect(result.ok).toBe(true);
    expect(result.validCount).toBe(12);
    expect(result.samples.length).toBe(12);
  });

  test("exactly 12 valid samples boundary passes, 11 fails", () => {
    expect(assessHrQuality(validWindow(12), NOW).ok).toBe(true);
    const eleven = assessHrQuality(validWindow(11), NOW);
    expect(eleven.ok).toBe(false);
    expect(eleven.reason).toBe("too_few_samples");
  });

  test("too many degraded/missing (>30%) fails", () => {
    // 12 valid + 6 suspect = 18 considered, degraded fraction 6/18 = 33.3% > 30%
    const rows = [...validWindow(12), ...Array.from({ length: 6 }, (_, i) => row(70, 100 + i, "suspect"))];
    const result = assessHrQuality(rows, NOW);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too_many_degraded");
  });

  test("exactly 30% degraded boundary passes", () => {
    // 14 valid + 6 suspect = 20 considered, 30% degraded — NOT > 30%
    const rows = [...validWindow(14), ...Array.from({ length: 6 }, (_, i) => row(70, 100 + i, "suspect"))];
    const result = assessHrQuality(rows, NOW);
    expect(result.ok).toBe(true);
    expect(result.degradedOrMissingCount).toBe(6);
  });

  test("stale window fails (newest valid sample older than 10 minutes)", () => {
    // Mọi sample đều ≥ 11 phút tuổi → stale
    const rows = validWindow(12).map((r, i) => ({
      ...r,
      observedAt: new Date(NOW.getTime() - (11 + i) * 60_000).toISOString(),
    }));
    const result = assessHrQuality(rows, NOW);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("stale");
  });

  test("technical range 30–220 bpm: out-of-range values are not counted valid", () => {
    const low = parseHrSample(row(29, 1));
    const high = parseHrSample(row(221, 1));
    const ok = parseHrSample(row(220, 1));
    expect(low).toBeNull();
    expect(high).toBeNull();
    expect(ok?.quality).toBe("valid");
  });

  test("invalid quality_status maps to missing; payload garbage is skipped", () => {
    expect(parseHrSample(row(70, 1, "invalid"))?.quality).toBe("missing");
    expect(parseHrSample(row(70, 1, "suspect"))?.quality).toBe("degraded");
    const garbage: TelemetrySampleInput = { eventId: "x", observedAt: NOW.toISOString(), qualityStatus: "good", payload: "not-json" };
    expect(parseHrSample(garbage)).toBeNull();
    const missingField: TelemetrySampleInput = { eventId: "y", observedAt: NOW.toISOString(), qualityStatus: "good", payload: JSON.stringify({ spo2_pct: 98 }) };
    expect(parseHrSample(missingField)).toBeNull();
  });
});
