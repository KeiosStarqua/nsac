// Readiness tab panels for the `/` mock console: four tabs, four displayed rows each, all resolved
// from the shared fixture. Pure — the component injects the localized row labels, vitest covers the
// rest.
//
// `barPct` is the row's relative fill on its OWN illustrative scale (see BAR_SCALES below). It is a
// drawing hint, not a threshold and not a clinical range: the demo must never imply a medical limit.
import { formatSleep, HUD_MOCK, signedKcal, type HudMockFixture } from "./fixture";

export const TAB_IDS = ["body", "recovery", "cognitive", "energy"] as const;
export type TabId = (typeof TAB_IDS)[number];

export const ROW_IDS = [
  "bodyWeight",
  "muscleMass",
  "boneMineral",
  "bodyFat",
  "sleepDuration",
  "sleepEfficiency",
  "hrv",
  "fatigue",
  "reactionTime",
  "mathAccuracy",
  "mood",
  "attention",
  "energyBurned",
  "energyIntake",
  "energyBalance",
  "activity",
] as const;
export type RowId = (typeof ROW_IDS)[number];

export const ROWS_BY_TAB: Readonly<Record<TabId, readonly RowId[]>> = {
  body: ["bodyWeight", "muscleMass", "boneMineral", "bodyFat"],
  recovery: ["sleepDuration", "sleepEfficiency", "hrv", "fatigue"],
  cognitive: ["reactionTime", "mathAccuracy", "mood", "attention"],
  energy: ["energyBurned", "energyIntake", "energyBalance", "activity"],
};

/**
 * Illustrative upper end of each row's bar, chosen so the four bars in a tab read as different
 * lengths. Not a reference range, not a target, not a threshold.
 */
const BAR_SCALES: Readonly<Record<RowId, { max: number; value: (fixture: HudMockFixture) => number }>> = {
  bodyWeight: { max: 100, value: (fx) => fx.body.weightKg },
  muscleMass: { max: 50, value: (fx) => fx.body.muscleMassKg },
  boneMineral: { max: 5, value: (fx) => fx.body.boneMineralKg },
  bodyFat: { max: 40, value: (fx) => fx.body.bodyFatPct },
  sleepDuration: { max: 480, value: (fx) => fx.recovery.sleepMinutes },
  sleepEfficiency: { max: 100, value: (fx) => fx.recovery.sleepEfficiencyPct },
  hrv: { max: 70, value: (fx) => fx.recovery.hrvMs },
  // Fatigue is a level word, so the bar shows a fixed low level (lower is better — still neutral).
  fatigue: { max: 100, value: () => 22 },
  reactionTime: { max: 500, value: (fx) => fx.cognitive.reactionMs },
  mathAccuracy: { max: 100, value: (fx) => fx.cognitive.mathAccuracyPct },
  mood: { max: 80, value: (fx) => fx.cognitive.moodTScore },
  attention: { max: 100, value: () => 80 },
  energyBurned: { max: 3000, value: (fx) => fx.energy.burnedKcal },
  energyIntake: { max: 3000, value: (fx) => fx.energy.intakeKcal },
  energyBalance: { max: 300, value: (fx) => Math.abs(fx.energy.balanceKcal) },
  activity: { max: 60, value: (fx) => fx.energy.activityMinutes },
};

export interface PanelRow {
  readonly id: RowId;
  /** Localized row label. */
  readonly label: string;
  /** Number + English unit, exactly as the reference mock writes it. */
  readonly valueText: string;
  /** 0–100 fill of the row's thin bar. */
  readonly barPct: number;
}

export interface Panel {
  readonly id: TabId;
  readonly rows: readonly PanelRow[];
}

/** `2340` → `"2,340"` — grouping is hand-rolled so server and client always agree. */
export function groupThousands(value: number): string {
  const rounded = Math.round(value);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Localized level words that double as a row's value (no number, no unit). */
export interface PanelLevels {
  readonly fatigue: string;
  readonly attention: string;
}

function valueTextFor(id: RowId, fx: HudMockFixture, levels: PanelLevels): string {
  switch (id) {
    case "bodyWeight":
      return `${fx.body.weightKg.toFixed(1)} kg`;
    case "muscleMass":
      return `${fx.body.muscleMassKg.toFixed(1)} kg`;
    case "boneMineral":
      return `${fx.body.boneMineralKg.toFixed(1)} kg`;
    case "bodyFat":
      return `${fx.body.bodyFatPct.toFixed(1)} %`;
    case "sleepDuration":
      return formatSleep(fx.recovery.sleepMinutes);
    case "sleepEfficiency":
      return `${fx.recovery.sleepEfficiencyPct} %`;
    case "hrv":
      return `${fx.recovery.hrvMs} ms`;
    case "fatigue":
      // The level word is localized; the instrument name stays as-is.
      return levels.fatigue;
    case "reactionTime":
      return `${fx.cognitive.reactionMs} ms`;
    case "mathAccuracy":
      return `${fx.cognitive.mathAccuracyPct} %`;
    case "mood":
      return `${fx.cognitive.moodTScore} T`;
    case "attention":
      return levels.attention;
    case "energyBurned":
      return `${groupThousands(fx.energy.burnedKcal)} kcal`;
    case "energyIntake":
      return `${groupThousands(fx.energy.intakeKcal)} kcal`;
    case "energyBalance":
      return `${signedKcal(fx.energy.balanceKcal)} kcal`;
    case "activity":
      return `${fx.energy.activityMinutes} min`;
    default:
      return "";
  }
}

/**
 * Build the four tab panels. `labels` carries the localized row labels (plus the two level words);
 * the numbers always come from `fixture`.
 */
export function buildPanels(
  labels: Readonly<Record<RowId, string>>,
  levels: PanelLevels,
  fixture: HudMockFixture = HUD_MOCK,
): Record<TabId, Panel> {
  const panels = {} as Record<TabId, Panel>;
  for (const tab of TAB_IDS) {
    panels[tab] = {
      id: tab,
      rows: ROWS_BY_TAB[tab].map((id) => {
        const scale = BAR_SCALES[id];
        const value = scale.value(fixture);
        const barPct = Math.round(Math.min(1, Math.max(0, value / scale.max)) * 100);
        return { id, label: labels[id], valueText: valueTextFor(id, fixture, levels), barPct };
      }),
    };
  }
  return panels;
}
