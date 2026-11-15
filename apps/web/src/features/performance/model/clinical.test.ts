import { describe, expect, it } from "vitest";
import {
  dataKindChip,
  methodUrlOf,
  relativeObservedAt,
  specialistLabel,
  toFindingRow,
  toneForSeverity,
} from "./clinical";
import { clinicalFindingSchema, type ClinicalFinding } from "../../clinical/model/findings";

const baseFinding = clinicalFindingSchema.parse({
  id: "f-001",
  astronautId: "ayla-reyes",
  specialistId: "sky-cardio",
  observedAt: "2026-11-15T08:30:00.000Z",
  metricIds: ["heart_rate"],
  severity: "yellow",
  status: "new",
  summary: "Resting heart rate trended 8% above the simulated baseline over 14 days.",
  evidence: {
    sourceIds: ["src-1"],
    dataKind: "simulated",
    thresholdSource: "https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665",
    quality: "valid",
  },
  requiresMedicalReview: false,
});

describe("toFindingRow", () => {
  it("maps severity to tone verbatim", () => {
    expect(toneForSeverity("green")).toBe("green");
    expect(toneForSeverity("yellow")).toBe("yellow");
    expect(toneForSeverity("red")).toBe("red");
    expect(toneForSeverity("unknown")).toBe("unknown");
  });

  it("produces a SIMULATED chip and carries quality + review flag", () => {
    const row = toFindingRow(baseFinding);
    expect(row.dataKindChip).toBe("SIMULATED");
    expect(row.quality).toBe("valid");
    expect(row.requiresMedicalReview).toBe(false);
    expect(row.status).toBe("new");
    expect(row.methodUrl).toBe("https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665");
  });

  it("chips every dataKind", () => {
    expect(dataKindChip("simulated")).toBe("SIMULATED");
    expect(dataKindChip("analog-study")).toBe("ANALOG-STUDY");
    expect(dataKindChip("measured")).toBe("MEASURED");
    expect(dataKindChip("predicted")).toBe("PREDICTED");
  });
});

describe("specialistLabel", () => {
  it("strips the sky- prefix and capitalizes words", () => {
    expect(specialistLabel("sky-cardio")).toBe("Cardio");
    expect(specialistLabel("sky-space-weather")).toBe("Space Weather");
    expect(specialistLabel("sky-musculoskeletal_coach")).toBe("Musculoskeletal Coach");
  });

  it("keeps non-sky ids readable instead of blank", () => {
    expect(specialistLabel("cardio")).toBe("Cardio");
    expect(specialistLabel("sky-")).toBe("sky-");
  });
});

describe("methodUrlOf", () => {
  it("keeps https links only", () => {
    expect(methodUrlOf("https://example.org/a")).toBe("https://example.org/a");
    expect(methodUrlOf("http://example.org/a")).toBeNull();
    expect(methodUrlOf("javascript:alert(1)")).toBeNull();
    expect(methodUrlOf("ftp://example.org")).toBeNull();
    expect(methodUrlOf(undefined)).toBeNull();
    expect(methodUrlOf("")).toBeNull();
  });
});

describe("relativeObservedAt", () => {
  const now = Date.parse("2026-11-16T12:00:00.000Z");

  it("renders minutes ago in en and vi", () => {
    expect(relativeObservedAt("2026-11-16T11:55:00.000Z", "en", now)).toMatch(/5 minute/);
    expect(relativeObservedAt("2026-11-16T11:55:00.000Z", "vi", now)).toMatch(/5 phút/);
  });

  it("renders days ago", () => {
    expect(relativeObservedAt("2026-11-13T12:00:00.000Z", "en", now)).toMatch(/3 day/);
  });

  it("returns null for invalid timestamps", () => {
    expect(relativeObservedAt("not-a-date", "en", now)).toBeNull();
    expect(relativeObservedAt("", "vi", now)).toBeNull();
  });

  it("handles future timestamps without crashing", () => {
    const out = relativeObservedAt("2026-11-17T12:00:00.000Z", "en", now);
    expect(out).toMatch(/tomorrow|day|hour/);
  });
});
