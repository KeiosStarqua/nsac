import { describe, expect, it } from "vitest";
import {
  deterministicClinicalSummary,
  effectiveRequiresMedicalReview,
  parseClinicalCaseSummary,
  CLINICAL_DISCLAIMER,
} from "../../clinical/model/summary";
import { clinicalFindingSchema, type ClinicalFinding } from "../../clinical/model/findings";

const finding = (over: Partial<Parameters<typeof clinicalFindingSchema.parse>[0]> = {}): ClinicalFinding =>
  clinicalFindingSchema.parse({
    id: "f-1",
    astronautId: "ayla-reyes",
    specialistId: "sky-cardio",
    observedAt: "2026-11-15T08:30:00.000Z",
    metricIds: ["heart_rate"],
    severity: "yellow",
    status: "new",
    summary: "Resting heart rate above the simulated baseline.",
    evidence: { sourceIds: [], dataKind: "simulated", quality: "valid" },
    requiresMedicalReview: false,
    ...over,
  });

const validJson = JSON.stringify({
  summary: "Ayla's findings are stable with one watch item.",
  keyFindings: [
    { specialistId: "sky-cardio", severity: "yellow", oneLine: "resting HR above baseline" },
  ],
  requiresMedicalReview: false,
  disclaimer: "AI-generated, not a substitute for a physician",
});

describe("parseClinicalCaseSummary", () => {
  it("passes a valid object", () => {
    const parsed = parseClinicalCaseSummary(validJson);
    expect(parsed).not.toBeNull();
    expect(parsed!.summary).toContain("Ayla");
    expect(parsed!.keyFindings).toHaveLength(1);
    expect(parsed!.requiresMedicalReview).toBe(false);
  });

  it("passes fenced JSON", () => {
    const fenced = "```json\n" + validJson + "\n```";
    expect(parseClinicalCaseSummary(fenced)?.summary).toContain("Ayla");
  });

  it("recovers an object surrounded by prose", () => {
    expect(parseClinicalCaseSummary(`Here you go:\n${validJson}\nDone.`)?.summary).toContain("Ayla");
  });

  it("returns null for garbage", () => {
    expect(parseClinicalCaseSummary("not json at all")).toBeNull();
    expect(parseClinicalCaseSummary("{ broken json")).toBeNull();
  });

  it("returns null when requiresMedicalReview is missing or not a boolean", () => {
    const noFlag = JSON.parse(validJson) as Record<string, unknown>;
    delete noFlag.requiresMedicalReview;
    expect(parseClinicalCaseSummary(JSON.stringify(noFlag))).toBeNull();
    const badFlag = { ...JSON.parse(validJson), requiresMedicalReview: "yes" };
    expect(parseClinicalCaseSummary(JSON.stringify(badFlag))).toBeNull();
  });

  it("drops keyFindings whose severity is outside the enum, keeps the summary", () => {
    const mixed = JSON.stringify({
      summary: "Summary stays even with a bad row.",
      keyFindings: [
        { specialistId: "sky-cardio", severity: "orange", oneLine: "not a real severity" },
        { specialistId: "sky-cardio", severity: "red", oneLine: "valid row" },
      ],
      requiresMedicalReview: true,
      disclaimer: "whatever the model wrote",
    });
    const parsed = parseClinicalCaseSummary(mixed);
    expect(parsed).not.toBeNull();
    expect(parsed!.keyFindings).toHaveLength(1);
    expect(parsed!.keyFindings[0]!.severity).toBe("red");
    expect(parsed!.summary).toContain("Summary stays");
  });

  it("truncates summary >600 chars instead of rejecting", () => {
    const long = JSON.stringify({ ...JSON.parse(validJson), summary: "x".repeat(900) });
    expect(parseClinicalCaseSummary(long)!.summary).toHaveLength(600);
  });

  it("caps keyFindings at 5 and truncates oneLine at 140", () => {
    const many = JSON.stringify({
      ...JSON.parse(validJson),
      keyFindings: Array.from({ length: 8 }, (_, i) => ({
        specialistId: `sky-spec-${i}`,
        severity: "green",
        oneLine: "y".repeat(200),
      })),
    });
    const parsed = parseClinicalCaseSummary(many)!;
    expect(parsed.keyFindings).toHaveLength(5);
    expect(parsed.keyFindings[0]!.oneLine.length).toBe(140);
  });

  it("forces the disclaimer to the exact constant, even if the model drifted", () => {
    const drifted = JSON.stringify({ ...JSON.parse(validJson), disclaimer: "not the right sentence" });
    expect(parseClinicalCaseSummary(drifted)!.disclaimer).toBe(CLINICAL_DISCLAIMER);
  });

  it("accepts an empty keyFindings array", () => {
    const emptyKf = JSON.stringify({ ...JSON.parse(validJson), keyFindings: [] });
    expect(parseClinicalCaseSummary(emptyKf)!.keyFindings).toHaveLength(0);
  });
});

describe("deterministicClinicalSummary", () => {
  it("requires medical review when any finding is red", () => {
    const summary = deterministicClinicalSummary([finding({ severity: "red" })], "en");
    expect(summary.requiresMedicalReview).toBe(true);
    expect(summary.summary).toContain("simulated");
    expect(summary.disclaimer).toBe(CLINICAL_DISCLAIMER);
  });

  it("requires medical review when any finding flags review (non-red)", () => {
    const summary = deterministicClinicalSummary(
      [finding({ severity: "yellow", requiresMedicalReview: true })],
      "en",
    );
    expect(summary.requiresMedicalReview).toBe(true);
  });

  it("does not require review for green/yellow findings without flags", () => {
    const summary = deterministicClinicalSummary(
      [finding({ severity: "green" }), finding({ severity: "yellow", id: "f-2" })],
      "en",
    );
    expect(summary.requiresMedicalReview).toBe(false);
    expect(summary.summary).toContain("2 validated");
    expect(summary.keyFindings.length).toBeLessThanOrEqual(5);
  });

  it("names red/yellow specialists in the summary", () => {
    const summary = deterministicClinicalSummary(
      [finding({ specialistId: "sky-cardio", severity: "red" })],
      "en",
    );
    expect(summary.summary).toContain("cardio");
  });

  it("produces a Vietnamese summary for locale vi", () => {
    const summary = deterministicClinicalSummary([finding({ severity: "yellow" })], "vi");
    expect(summary.summary).toContain("mô phỏng");
  });
});

describe("effectiveRequiresMedicalReview", () => {
  it("is true when the model flags it, even without data triggers", () => {
    expect(effectiveRequiresMedicalReview(true, [finding({ severity: "green" })])).toBe(true);
  });

  it("is true when data flags it, even if the model said false", () => {
    expect(effectiveRequiresMedicalReview(false, [finding({ severity: "red" })])).toBe(true);
    expect(
      effectiveRequiresMedicalReview(false, [finding({ severity: "yellow", requiresMedicalReview: true })]),
    ).toBe(true);
  });

  it("is false only when both agree nothing needs review", () => {
    expect(effectiveRequiresMedicalReview(false, [finding({ severity: "green" })])).toBe(false);
  });
});
