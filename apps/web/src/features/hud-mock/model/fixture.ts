// Fixture for the `/` mock console — "SKY · Astronaut Wellness".
//
// EVERY number here is synthetic and belongs to the fictional crew of the demo. No analog cohort
// value from `/research` is ever assigned to an astronaut here, no clinical threshold is encoded,
// and the units stay English on purpose (the reference mock labels them that way in both locales).
//
// ONE source of truth for the whole screen: the left column, the readiness tabs, the three mini
// cards and the bottom insight band all read this object, so 48 activity minutes, 7h 42m of sleep
// and 118/76 mmHg can never disagree between panels (covered by `fixture.test.ts`).
import { buildSeries } from "./sparklines";

/** Simulated mission clock — the same demo value the HUD header has always shown. */
export const MISSION_DAY = 170;

/** Sleep total, shared by the trends card and the recovery panel. */
const SLEEP_TOTAL_MINUTES = 7 * 60 + 42;
/** Active minutes, shared by the trends card, the energy panel and the activity mini card. */
const ACTIVITY_MINUTES = 48;
const ENERGY_BURNED_KCAL = 2340;
const ENERGY_INTAKE_KCAL = 2520;

export type FatigueLevel = "low";
export type AttentionLevel = "normal";

export interface VitalsWithSeries {
  readonly value: number;
  readonly unit: string;
  /** 24 deterministic points for the row's inline sparkline. */
  readonly series: readonly number[];
}

export interface HudMockFixture {
  readonly vitalSigns: {
    readonly heartRate: VitalsWithSeries;
    readonly bloodPressure: {
      readonly systolic: number;
      readonly diastolic: number;
      readonly unit: string;
      readonly series: readonly number[];
    };
    readonly respiratoryRate: VitalsWithSeries;
    readonly bloodOxygen: VitalsWithSeries;
    readonly bodyTemperature: VitalsWithSeries;
  };
  readonly quickTrends: {
    readonly heartRateAvg: number;
    readonly heartRateSeries: readonly number[];
    readonly sleepMinutes: number;
    /** Relative widths of the segmented sleep bar (illustrative, not a hypnogram). */
    readonly sleepBlocks: readonly number[];
    readonly activityMinutes: number;
    /** 24 relative bars for the activity strip (0…1). */
    readonly activityBars: readonly number[];
  };
  readonly readiness: {
    /** The ring's 0–100 value. */
    readonly score: number;
    /** The small secondary 0–100 value beside the ring. */
    readonly support: number;
  };
  readonly body: {
    readonly weightKg: number;
    readonly muscleMassKg: number;
    readonly boneMineralKg: number;
    readonly bodyFatPct: number;
  };
  readonly recovery: {
    readonly sleepMinutes: number;
    readonly sleepEfficiencyPct: number;
    readonly hrvMs: number;
    readonly fatigue: FatigueLevel;
  };
  readonly cognitive: {
    readonly reactionMs: number;
    readonly mathAccuracyPct: number;
    readonly moodTScore: number;
    readonly attention: AttentionLevel;
  };
  readonly energy: {
    readonly burnedKcal: number;
    readonly intakeKcal: number;
    /** Always `intakeKcal - burnedKcal`; asserted in the fixture test. */
    readonly balanceKcal: number;
    readonly activityMinutes: number;
  };
  readonly cards: {
    readonly activityMinutes: number;
    readonly activityDeltaPct: number;
    readonly burnedKcal: number;
    readonly intakeKcal: number;
    readonly balanceKcal: number;
  };
}

const HEART_RATE_SERIES = buildSeries(11, 24, 62, 6);
const SYSTOLIC_SERIES = buildSeries(23, 24, 118, 5);
const RESPIRATORY_SERIES = buildSeries(37, 24, 16, 1.6);
const SPO2_SERIES = buildSeries(53, 24, 98, 0.6);
const TEMPERATURE_SERIES = buildSeries(71, 24, 36.7, 0.12);
const TREND_HEART_RATE_SERIES = buildSeries(97, 48, 62, 7);
const ACTIVITY_BARS = buildSeries(131, 24, 0.45, 0.42).map((value) =>
  Math.min(1, Math.max(0.06, value)),
);

export const HUD_MOCK: HudMockFixture = {
  vitalSigns: {
    heartRate: { value: 62, unit: "bpm", series: HEART_RATE_SERIES },
    bloodPressure: { systolic: 118, diastolic: 76, unit: "mmHg", series: SYSTOLIC_SERIES },
    respiratoryRate: { value: 16, unit: "breaths/min", series: RESPIRATORY_SERIES },
    bloodOxygen: { value: 98, unit: "%", series: SPO2_SERIES },
    bodyTemperature: { value: 36.7, unit: "°C", series: TEMPERATURE_SERIES },
  },
  quickTrends: {
    heartRateAvg: 62,
    heartRateSeries: TREND_HEART_RATE_SERIES,
    sleepMinutes: SLEEP_TOTAL_MINUTES,
    sleepBlocks: [0.32, 0.58, 0.46, 0.66, 0.38],
    activityMinutes: ACTIVITY_MINUTES,
    activityBars: ACTIVITY_BARS,
  },
  readiness: { score: 86, support: 96 },
  body: {
    weightKg: 72.4,
    muscleMassKg: 32.1,
    boneMineralKg: 2.8,
    bodyFatPct: 18.5,
  },
  recovery: {
    sleepMinutes: SLEEP_TOTAL_MINUTES,
    sleepEfficiencyPct: 91,
    hrvMs: 49,
    fatigue: "low",
  },
  cognitive: {
    reactionMs: 312,
    mathAccuracyPct: 91,
    moodTScore: 44,
    attention: "normal",
  },
  energy: {
    burnedKcal: ENERGY_BURNED_KCAL,
    intakeKcal: ENERGY_INTAKE_KCAL,
    balanceKcal: ENERGY_INTAKE_KCAL - ENERGY_BURNED_KCAL,
    activityMinutes: ACTIVITY_MINUTES,
  },
  cards: {
    activityMinutes: ACTIVITY_MINUTES,
    activityDeltaPct: 12,
    burnedKcal: ENERGY_BURNED_KCAL,
    intakeKcal: ENERGY_INTAKE_KCAL,
    balanceKcal: ENERGY_INTAKE_KCAL - ENERGY_BURNED_KCAL,
  },
};

/** `462` → `"7h 42m"` — one formatting rule for every sleep reading on the screen. */
export function formatSleep(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

/** `180` → `"+180"`, `-40` → `"-40"`. */
export function signedKcal(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : ""}${rounded}`;
}

/** `118` / `76` → `"118/76"`. */
export function formatBloodPressure(systolic: number, diastolic: number): string {
  return `${Math.round(systolic)}/${Math.round(diastolic)}`;
}
