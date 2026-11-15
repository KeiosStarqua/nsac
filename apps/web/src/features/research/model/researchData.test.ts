import { describe, expect, test } from "vitest";
import {
  EMPTY_RESEARCH_DATASET,
  dataCardUrl,
  formatStat,
  parseCsvRows,
  parseResearchData,
  quantile,
  researchData,
  statsFromCsv,
  summarizeValues,
} from "./researchData";

const FIXTURE = [
  "subject_id,cutoff_time,last_value",
  "a,1,2",
  "b,2,4",
  "c,3,4",
  "d,4,4",
  "e,5,5",
  "f,6,5",
  "g,7,7",
  "h,8,9",
  "",
].join("\n");

const ODD_FIXTURE = ["subject_id,cutoff_time,last_value", "a,1,10", "b,2,20", "c,3,30", ""].join("\n");

describe("quantile", () => {
  test("linear interpolation, even count", () => {
    const sorted = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(quantile(sorted, 0.5)).toBe(4.5);
    expect(quantile(sorted, 0.25)).toBe(4);
    expect(quantile(sorted, 0.75)).toBe(5.5);
  });

  test("linear interpolation, odd count", () => {
    const sorted = [10, 20, 30];
    expect(quantile(sorted, 0.5)).toBe(20);
    expect(quantile(sorted, 0.25)).toBe(15);
    expect(quantile(sorted, 0.75)).toBe(25);
  });

  test("single value and empty", () => {
    expect(quantile([42], 0.25)).toBe(42);
    expect(quantile([], 0.5)).toBeNaN();
  });
});

describe("summarizeValues", () => {
  test("median/IQR/min/max over the fixture", () => {
    expect(summarizeValues([2, 4, 4, 4, 5, 5, 7, 9])).toEqual({
      median: 4.5,
      q1: 4,
      q3: 5.5,
      min: 2,
      max: 9,
    });
  });

  test("throws on empty input", () => {
    expect(() => summarizeValues([])).toThrow();
  });
});

describe("statsFromCsv", () => {
  test("fixture rows → stats", () => {
    expect(statsFromCsv(FIXTURE, "last_value")).toEqual({
      median: 4.5,
      q1: 4,
      q3: 5.5,
      min: 2,
      max: 9,
      rows: 8,
      nSubjects: 8,
    });
  });

  test("odd-count fixture", () => {
    expect(statsFromCsv(ODD_FIXTURE, "last_value")).toEqual({
      median: 20,
      q1: 15,
      q3: 25,
      min: 10,
      max: 30,
      rows: 3,
      nSubjects: 3,
    });
  });

  test("missing column or no numeric values yields null", () => {
    expect(statsFromCsv(FIXTURE, "nope")).toBeNull();
    expect(statsFromCsv("subject_id,last_value\na,x\n", "last_value")).toBeNull();
  });
});

describe("parseCsvRows", () => {
  test("header + rows", () => {
    const rows = parseCsvRows(ODD_FIXTURE);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ subject_id: "a", cutoff_time: "1", last_value: "10" });
  });
});

describe("parseResearchData", () => {
  test("corrupt input falls back to the empty dataset instead of throwing", () => {
    expect(parseResearchData(undefined)).toBe(EMPTY_RESEARCH_DATASET);
    expect(parseResearchData("not json")).toBe(EMPTY_RESEARCH_DATASET);
    expect(parseResearchData({ generatedFrom: 1, tasks: "nope" })).toBe(EMPTY_RESEARCH_DATASET);
    expect(
      parseResearchData({ generatedFrom: "x", tasks: [{ id: "hr" }] }),
    ).toBe(EMPTY_RESEARCH_DATASET);
    expect(parseResearchData(undefined).tasks).toHaveLength(0);
  });
});

describe("committed research-data.json bundle", () => {
  test("parses and covers the 22 cards across the 5 groups", () => {
    expect(researchData.tasks).toHaveLength(22);
    expect(new Set(researchData.tasks.map((task) => task.group))).toEqual(
      new Set(["cardiometabolic", "musculoskeletal", "neuro", "sleepBehavior", "fitnessDose"]),
    );
    for (const task of researchData.tasks) {
      expect(task.median).toBeGreaterThanOrEqual(task.min);
      expect(task.median).toBeLessThanOrEqual(task.max);
      expect(task.q1).toBeLessThanOrEqual(task.q3);
      expect(task.rows).toBeGreaterThan(0);
      expect(task.nSubjects).toBeGreaterThan(0);
      expect(task.subjects).toHaveLength(task.nSubjects);
    }
  });

  test("every task id maps to a GitHub data-card URL with its run id", () => {
    for (const task of researchData.tasks) {
      expect(dataCardUrl(task.id, task.runId)).toBe(
        `https://github.com/wosonday/nsac-data/tree/main/data/2_features/${task.id}/${task.runId}`,
      );
    }
  });
});

describe("formatStat", () => {
  test("precision follows magnitude", () => {
    expect(formatStat(490)).toBe("490");
    expect(formatStat(73.277)).toBe("73.3");
    expect(formatStat(-7.834)).toBe("-7.83");
    expect(formatStat(0.062)).toBe("0.06");
  });
});
