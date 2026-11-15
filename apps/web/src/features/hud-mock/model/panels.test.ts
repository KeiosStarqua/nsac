import { describe, expect, test } from "vitest";
import { HUD_MOCK } from "./fixture";
import {
  ROWS_BY_TAB,
  TAB_IDS,
  buildPanels,
  groupThousands,
  type PanelLevels,
  type RowId,
} from "./panels";

const LABELS: Record<RowId, string> = {
  bodyWeight: "Body Weight",
  muscleMass: "Muscle Mass",
  boneMineral: "Bone Mineral Content",
  bodyFat: "Body Fat",
  sleepDuration: "Sleep Duration",
  sleepEfficiency: "Sleep Efficiency",
  hrv: "HRV",
  fatigue: "Fatigue",
  reactionTime: "Reaction Time",
  mathAccuracy: "Math Accuracy",
  mood: "POMS (mood)",
  attention: "Attention Span",
  energyBurned: "Burned",
  energyIntake: "Intake",
  energyBalance: "Balance",
  activity: "Activity",
};

const LEVELS: PanelLevels = { fatigue: "Low (MFSI-SF)", attention: "Normal" };

describe("readiness panels", () => {
  const panels = buildPanels(LABELS, LEVELS);

  test("all four tabs exist with four rows each", () => {
    expect(TAB_IDS).toEqual(["body", "recovery", "cognitive", "energy"]);
    for (const tab of TAB_IDS) {
      expect(panels[tab].id).toBe(tab);
      expect(panels[tab].rows).toHaveLength(4);
      expect(panels[tab].rows.map((row) => row.id)).toEqual([...ROWS_BY_TAB[tab]]);
    }
  });

  test("bar fills are whole percentages inside the track", () => {
    for (const tab of TAB_IDS) {
      for (const row of panels[tab].rows) {
        expect(Number.isInteger(row.barPct)).toBe(true);
        expect(row.barPct).toBeGreaterThan(0);
        expect(row.barPct).toBeLessThanOrEqual(100);
      }
    }
  });

  test("body composition values come from the fixture", () => {
    expect(panels.body.rows.map((row) => row.valueText)).toEqual([
      "72.4 kg",
      "32.1 kg",
      "2.8 kg",
      "18.5 %",
    ]);
  });

  test("recovery, cognitive and energy rows read the same fixture fields as the rest of the page", () => {
    expect(panels.recovery.rows.map((row) => row.valueText)).toEqual([
      "7h 42m",
      "91 %",
      "49 ms",
      "Low (MFSI-SF)",
    ]);
    expect(panels.cognitive.rows.map((row) => row.valueText)).toEqual([
      "312 ms",
      "91 %",
      "44 T",
      "Normal",
    ]);
    expect(panels.energy.rows.map((row) => row.valueText)).toEqual([
      "2,340 kcal",
      "2,520 kcal",
      "+180 kcal",
      "48 min",
    ]);
    // The energy tab's activity row is the same 48 minutes as the trends card and the mini card.
    expect(HUD_MOCK.quickTrends.activityMinutes).toBe(48);
    expect(HUD_MOCK.cards.activityMinutes).toBe(48);
  });

  test("grouping is deterministic", () => {
    expect(groupThousands(2340)).toBe("2,340");
    expect(groupThousands(180)).toBe("180");
    expect(groupThousands(1234567)).toBe("1,234,567");
  });
});
