// Contract + presentation model for `/research` (SKY / Research Evidence).
//
// Every number here comes from REAL NASA analog research datasets (UTMB CFT70
// bedrest, MMASH, RadLab, …) via the read-only `data/` git submodule — they
// describe research cohorts, never the fictional Sky crew. The bundle is
// generated at authoring time by `apps/web/scripts/extract-research.mjs` and
// committed as `research-data.json`; this module zod-parses it at import time
// so a corrupt bundle degrades to an explicit empty state instead of a crash.
// Pure logic only — no React, no DOM, no IO — so vitest covers it directly.
import { z } from "zod";
import rawResearchData from "../research-data.json";

export const RESEARCH_GROUPS = [
  "cardiometabolic",
  "musculoskeletal",
  "neuro",
  "sleepBehavior",
  "fitnessDose",
] as const;
export type ResearchGroup = (typeof RESEARCH_GROUPS)[number];

const researchTaskSchema = z.object({
  id: z.string().min(1),
  group: z.enum(RESEARCH_GROUPS),
  runId: z.string().min(1),
  statColumn: z.string().min(1),
  statKind: z.enum(["window", "delta"]),
  unit: z.string(),
  cohort: z.string().min(1),
  licence: z.string().min(1),
  rows: z.number().int().nonnegative(),
  subjects: z.array(z.string()),
  nSubjects: z.number().int().nonnegative(),
  median: z.number(),
  q1: z.number(),
  q3: z.number(),
  min: z.number(),
  max: z.number(),
});

export const researchDatasetSchema = z.object({
  generatedFrom: z.string(),
  tasks: z.array(researchTaskSchema),
});

export type ResearchTask = z.infer<typeof researchTaskSchema>;

export interface ResearchDataset {
  generatedFrom: string;
  tasks: ResearchTask[];
}

/** Returned when the bundle fails validation — the page renders its empty state, never a guess. */
export const EMPTY_RESEARCH_DATASET: ResearchDataset = { generatedFrom: "invalid", tasks: [] };

export function parseResearchData(input: unknown): ResearchDataset {
  const result = researchDatasetSchema.safeParse(input);
  return result.success ? result.data : EMPTY_RESEARCH_DATASET;
}

/** The committed bundle, zod-parsed once at import time. */
export const researchData: ResearchDataset = parseResearchData(rawResearchData);

export function dataCardUrl(taskId: string, runId: string): string {
  return `https://github.com/wosonday/nsac-data/tree/main/data/2_features/${taskId}/${runId}`;
}

/** Linear-interpolation quantile (numpy "linear" method). `sorted` must be ascending. */
export function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = sorted[base]!;
  const hi = sorted[base + 1] ?? lo;
  return lo + (hi - lo) * rest;
}

export interface WindowStats {
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

export function summarizeValues(values: readonly number[]): WindowStats {
  if (values.length === 0) throw new Error("summarizeValues: no values");
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: quantile(sorted, 0.5),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  };
}

/** Minimal CSV reader for the committed feature tables (fixture tests only — runtime never parses CSV). */
export function parseCsvRows(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const header = (lines[0] ?? "").split(",").map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((name, index) => {
      row[name] = (cells[index] ?? "").trim();
    });
    return row;
  });
}

/** Stats for one column of a fixture CSV — mirrors the authoring-time extractor (linear quantiles). */
export function statsFromCsv(
  text: string,
  column: string,
): (WindowStats & { rows: number; nSubjects: number }) | null {
  const grid = parseCsvRows(text);
  const values: number[] = [];
  const subjects = new Set<string>();
  for (const row of grid) {
    const cell = row[column];
    if (cell === undefined) return null;
    const value = Number(cell);
    if (Number.isNaN(value)) continue;
    values.push(value);
    if (row.subject_id) subjects.add(row.subject_id);
  }
  if (values.length === 0) return null;
  return { ...summarizeValues(values), rows: values.length, nSubjects: subjects.size };
}

/** Compact display format: ≤2 decimals below 10, 1 below 100, else none; never grouped. */
export function formatStat(value: number): string {
  const abs = Math.abs(value);
  const maximumFractionDigits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits, useGrouping: false }).format(value);
}

/** Grouped integer format for row/subject counts. */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}
