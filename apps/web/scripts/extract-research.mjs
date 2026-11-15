// Authoring-time generator for `src/features/research/research-data.json`.
//
// Reads the REAL analog NASA research tables inside the `data/` git submodule
// (READ-ONLY — this script never writes under `data/`), computes simple window
// statistics per task and emits a small, deterministic JSON bundle that the
// `/research` page renders. The page itself is fully static: it does NOT read
// the filesystem and does NOT parse gzip at request time.
//
// Run only at authoring time (after bumping the `data/` submodule), from the
// repository root or anywhere else:
//
//   node apps/web/scripts/extract-research.mjs
//   (or: bun apps/web/scripts/extract-research.mjs)
//
// then commit the regenerated `research-data.json`. Verification gates of the
// app never need the submodule.
//
// Contract: analog cohort research — the numbers describe RESEARCH COHORTS
// (MMASH / UTMB CFT70 bedrest / RadLab / ...), never the fictional Sky crew.
// Percentile method: linear interpolation between closest ranks, i.e. the same
// algorithm numpy calls `linear` (default), documented for reproducibility.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const featuresRoot = path.join(repoRoot, "data", "data", "2_features");
const outFile = path.join(repoRoot, "apps/web/src/features/research/research-data.json");

/**
 * The 22 cards, in display order per group.
 * `column` = the table column to summarise; `kind` = chip on the card
 * ("window" = distribution across overlapping past→cutoff feature windows,
 * "delta"  = Day-0→Day-70 change vs baseline for bedrest analogs).
 */
const TASKS = [
  // Cardiovascular & metabolic
  { id: "lv_mass", group: "cardiometabolic", column: "pct_change_day70", kind: "delta", unit: "%", cohort: "UTMB CFT70 · PRE→D70", licence: "NASA/NLSP fair-use" },
  { id: "lv_diastolic_volume", group: "cardiometabolic", column: "pct_change_day70", kind: "delta", unit: "%", cohort: "UTMB CFT70 · 3D echo", licence: "NASA/NLSP fair-use" },
  { id: "lipid_ldl", group: "cardiometabolic", column: "pct_change_day70", kind: "delta", unit: "%", cohort: "UTMB CFT70 · lipids", licence: "NASA/NLSP fair-use" },
  { id: "glucose", group: "cardiometabolic", column: "delta_glucose_0", kind: "delta", unit: "mg/dL", cohort: "UTMB CFT70 · OGTT", licence: "NASA/NLSP fair-use" },
  { id: "vitals_sbp", group: "cardiometabolic", column: "last_value", kind: "window", unit: "mmHg", cohort: "UTMB CFT70 · CRF vitals", licence: "NASA/NLSP fair-use" },
  { id: "vitals_dbp", group: "cardiometabolic", column: "last_value", kind: "window", unit: "mmHg", cohort: "UTMB CFT70 · CRF vitals", licence: "NASA/NLSP fair-use" },
  { id: "vitals_pulse", group: "cardiometabolic", column: "last_value", kind: "window", unit: "bpm", cohort: "UTMB CFT70 · CRF vitals", licence: "NASA/NLSP fair-use" },
  { id: "vitals_temp", group: "cardiometabolic", column: "last_value", kind: "window", unit: "°C", cohort: "UTMB CFT70 · CRF vitals", licence: "NASA/NLSP fair-use" },
  { id: "vitals_weight", group: "cardiometabolic", column: "last_value", kind: "window", unit: "kg", cohort: "UTMB CFT70 · CRF vitals", licence: "NASA/NLSP fair-use" },
  { id: "hr", group: "cardiometabolic", column: "last_value", kind: "window", unit: "bpm", cohort: "MMASH 1.0.0", licence: "ODbL-1.0" },
  // Musculoskeletal (bedrest analog)
  { id: "bone_mineral", group: "musculoskeletal", column: "pct_change_day70", kind: "delta", unit: "%", cohort: "UTMB CFT70 · iDXA", licence: "NASA/NLSP fair-use" },
  { id: "lean_mass_legs", group: "musculoskeletal", column: "pct_change_day70", kind: "delta", unit: "%", cohort: "UTMB CFT70 · iDXA", licence: "NASA/NLSP fair-use" },
  { id: "muscle_quadriceps", group: "musculoskeletal", column: "pct_change_day69", kind: "delta", unit: "%", cohort: "UTMB CFT70 · iRATS MRI", licence: "NASA/NLSP fair-use" },
  { id: "muscle_soleus", group: "musculoskeletal", column: "pct_change_day69", kind: "delta", unit: "%", cohort: "UTMB CFT70 · iRATS MRI", licence: "NASA/NLSP fair-use" },
  // Neuro / cognitive
  { id: "cognition_cpt_rt", group: "neuro", column: "last_value", kind: "window", unit: "ms", cohort: "UTMB MR085G · WinSCAT", licence: "NASA/NLSP fair-use" },
  { id: "cognition_math_acc", group: "neuro", column: "last_value", kind: "window", unit: "%", cohort: "UTMB MR085G · WinSCAT", licence: "NASA/NLSP fair-use" },
  // Sleep & behavior
  { id: "sleep_act", group: "sleepBehavior", column: "last_value", kind: "window", unit: "%", cohort: "UTMB Campaign 1 · BRSMAct", licence: "NASA/NLSP fair-use" },
  { id: "sleep_act_duration", group: "sleepBehavior", column: "last_value", kind: "window", unit: "h", cohort: "UTMB Campaign 1 · BRSMAct", licence: "NASA/NLSP fair-use" },
  { id: "fatigue", group: "sleepBehavior", column: "last_value", kind: "window", unit: "MFSI-SF", cohort: "UTMB CFT70 · MFSI-SF", licence: "NASA/NLSP fair-use" },
  { id: "mood", group: "sleepBehavior", column: "last_value", kind: "window", unit: "POMS TMD", cohort: "UTMB CFT70 · POMS", licence: "NASA/NLSP fair-use" },
  // Fitness & dose
  { id: "cpet", group: "fitnessDose", column: "delta_vo2", kind: "delta", unit: "Δ REL VO₂peak", cohort: "UTMB CFT70 · CPET", licence: "NASA/NLSP fair-use" },
  { id: "dose", group: "fitnessDose", column: "last_value", kind: "window", unit: "µGy/h", cohort: "NASA OSDR · RadLab Lidal", licence: "NASA OSDR research reuse" },
];

/** Minimal RFC-4180-ish CSV parser (handles quoted fields with commas/quotes). */
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

/** Linear-interpolation quantile (numpy "linear" method). `sorted` must be ascending. */
function quantile(sorted, p) {
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = sorted[base];
  const hi = sorted[base + 1] ?? lo;
  return lo + (hi - lo) * rest;
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: quantile(sorted, 0.5),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function latestRun(taskId) {
  const dir = path.join(featuresRoot, taskId);
  const runs = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (runs.length === 0) throw new Error(`No run directories under ${dir}`);
  return runs[runs.length - 1];
}

const tasks = [];
for (const spec of TASKS) {
  const runId = latestRun(spec.id);
  const tablePath = path.join(featuresRoot, spec.id, runId, "table.csv.gz");
  const raw = gunzipSync(readFileSync(tablePath)).toString("utf8");
  const grid = parseCsv(raw);
  const header = grid[0];
  const body = grid.slice(1);
  const colIndex = header.indexOf(spec.column);
  const subjectIndex = header.indexOf("subject_id");
  if (colIndex === -1) throw new Error(`${spec.id}: column "${spec.column}" not in ${tablePath}`);
  if (subjectIndex === -1) throw new Error(`${spec.id}: column "subject_id" not in ${tablePath}`);

  const values = [];
  const subjects = new Set();
  for (const row of body) {
    const cell = row[colIndex];
    if (cell === undefined || cell === "" || Number.isNaN(Number(cell))) continue;
    values.push(Number(cell));
    const subject = row[subjectIndex];
    if (subject) subjects.add(subject);
  }
  if (values.length === 0) throw new Error(`${spec.id}: no numeric values for "${spec.column}"`);

  tasks.push({
    id: spec.id,
    group: spec.group,
    runId,
    statColumn: spec.column,
    statKind: spec.kind,
    unit: spec.unit,
    cohort: spec.cohort,
    licence: spec.licence,
    rows: values.length,
    subjects: [...subjects].sort(),
    nSubjects: subjects.size,
    ...summarize(values),
  });
}

const payload = {
  generatedFrom: "data/data/2_features/<task>/<latest run>/table.csv.gz (git submodule, read-only)",
  tasks,
};
writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n");
console.log(`Wrote ${outFile} — ${tasks.length} tasks`);
