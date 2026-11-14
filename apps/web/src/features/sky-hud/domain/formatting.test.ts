import { describe, expect, it } from "vitest";
import { formatVital, getReadingFreshness, getReadingVisualState, greetingFor } from "./formatting";
import { FIXTURE_MODEL, FIXTURE_LABEL } from "./fixtures";
import type { VitalReading } from "./types";

const v = (patch: Partial<VitalReading>): VitalReading => ({ ...FIXTURE_MODEL.vitals.heartRate, ...patch });

describe("formatVital", () => {
  it("formats reference values exactly", () => {
    expect(formatVital(FIXTURE_MODEL.vitals.heartRate)).toBe("62 bpm");
    expect(formatVital(FIXTURE_MODEL.vitals.respiration)).toBe("16 br/min");
    expect(formatVital(FIXTURE_MODEL.vitals.spo2)).toBe("98 %");
    expect(formatVital(FIXTURE_MODEL.vitals.sleep)).toBe("7 h 42 m");
  });
  it("renders an em dash for missing values", () => {
    expect(formatVital(v({ value: null }))).toBe("—");
  });
});

describe("getReadingFreshness", () => {
  const NOW = Date.parse(FIXTURE_MODEL.vitals.heartRate.timestamp!);
  it("returns current inside the window", () => {
    expect(getReadingFreshness(FIXTURE_MODEL.vitals.heartRate, NOW, 30 * 60 * 1000)).toBe("current");
  });
  it("returns stale beyond the window", () => {
    expect(getReadingFreshness(FIXTURE_MODEL.vitals.heartRate, NOW + 45 * 60 * 1000, 30 * 60 * 1000)).toBe("stale");
  });
  it("returns missing without a value", () => {
    expect(getReadingFreshness(v({ value: null }), NOW, 30 * 60 * 1000)).toBe("missing");
  });
});

describe("getReadingVisualState", () => {
  it("never calls unknown data normal", () => {
    expect(getReadingVisualState(v({ value: null }), 2)).toBe("unknown");
    expect(getReadingVisualState(v({ quality: "unknown" }), 2)).toBe("unknown");
  });
  it("honors the precomputed validated state", () => {
    expect(getReadingVisualState(v({ visualState: "critical" }), 2)).toBe("critical");
  });
});

describe("greetingFor", () => {
  it("greets in en and vi", () => {
    expect(greetingFor("en", 8, "Minh")).toBe("Good morning, Minh.");
    expect(greetingFor("vi", 8, "Minh")).toBe("Buổi sáng, Minh.");
  });
});

describe("fixtures", () => {
  it("labels the fixture set explicitly", () => {
    expect(FIXTURE_LABEL).toBe("Simulated data");
  });
});
