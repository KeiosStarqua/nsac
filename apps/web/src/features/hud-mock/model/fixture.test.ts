import { describe, expect, test } from "vitest";
import {
  HUD_MOCK,
  formatBloodPressure,
  formatSleep,
  signedKcal,
} from "./fixture";
import { buildInsightText } from "./insight";
import { buildSeries } from "./sparklines";
import { en } from "~/shared/i18n/en";
import { vi } from "~/shared/i18n/vi";

// The mock console's data contract: one fixture, every panel. These assertions are the guard that
// the left column, the readiness tabs, the mini cards and the insight band can never disagree.

describe("hud-mock fixture — reference values", () => {
  test("vital signs match the ordered mock values", () => {
    expect(HUD_MOCK.vitalSigns.heartRate.value).toBe(62);
    expect(HUD_MOCK.vitalSigns.heartRate.unit).toBe("bpm");
    expect(formatBloodPressure(HUD_MOCK.vitalSigns.bloodPressure.systolic, HUD_MOCK.vitalSigns.bloodPressure.diastolic)).toBe("118/76");
    expect(HUD_MOCK.vitalSigns.bloodPressure.unit).toBe("mmHg");
    expect(HUD_MOCK.vitalSigns.respiratoryRate.value).toBe(16);
    expect(HUD_MOCK.vitalSigns.bloodOxygen.value).toBe(98);
    expect(HUD_MOCK.vitalSigns.bodyTemperature.value).toBe(36.7);
    expect(HUD_MOCK.vitalSigns.bodyTemperature.unit).toBe("°C");
  });

  test("readiness scores stay inside their 0–100 scale", () => {
    expect(HUD_MOCK.readiness.score).toBe(86);
    expect(HUD_MOCK.readiness.support).toBe(96);
    for (const value of [HUD_MOCK.readiness.score, HUD_MOCK.readiness.support]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe("hud-mock fixture — cross-panel consistency", () => {
  test("activity minutes are the same number in the trends card, the energy tab and the mini card", () => {
    expect(HUD_MOCK.quickTrends.activityMinutes).toBe(48);
    expect(HUD_MOCK.energy.activityMinutes).toBe(HUD_MOCK.quickTrends.activityMinutes);
    expect(HUD_MOCK.cards.activityMinutes).toBe(HUD_MOCK.quickTrends.activityMinutes);
  });

  test("sleep duration is the same number in the trends card and the recovery tab", () => {
    expect(HUD_MOCK.quickTrends.sleepMinutes).toBe(HUD_MOCK.recovery.sleepMinutes);
    expect(formatSleep(HUD_MOCK.recovery.sleepMinutes)).toBe("7h 42m");
  });

  test("energy balance is derived from intake minus burned, everywhere", () => {
    expect(HUD_MOCK.energy.balanceKcal).toBe(HUD_MOCK.energy.intakeKcal - HUD_MOCK.energy.burnedKcal);
    expect(HUD_MOCK.cards.balanceKcal).toBe(HUD_MOCK.energy.balanceKcal);
    expect(HUD_MOCK.cards.burnedKcal).toBe(HUD_MOCK.energy.burnedKcal);
    expect(HUD_MOCK.cards.intakeKcal).toBe(HUD_MOCK.energy.intakeKcal);
    expect(signedKcal(HUD_MOCK.cards.balanceKcal)).toBe("+180");
  });

  test("every vital row carries a 24-point series", () => {
    const series = [
      HUD_MOCK.vitalSigns.heartRate.series,
      HUD_MOCK.vitalSigns.bloodPressure.series,
      HUD_MOCK.vitalSigns.respiratoryRate.series,
      HUD_MOCK.vitalSigns.bloodOxygen.series,
      HUD_MOCK.vitalSigns.bodyTemperature.series,
    ];
    for (const points of series) expect(points).toHaveLength(24);
    expect(HUD_MOCK.quickTrends.activityBars).toHaveLength(24);
    expect(HUD_MOCK.quickTrends.heartRateSeries.length).toBeGreaterThan(24);
    for (const bar of HUD_MOCK.quickTrends.activityBars) {
      expect(bar).toBeGreaterThanOrEqual(0);
      expect(bar).toBeLessThanOrEqual(1);
    }
  });

  test("the series are deterministic (server and client render the same markup)", () => {
    expect(buildSeries(11, 24, 62, 6)).toEqual(buildSeries(11, 24, 62, 6));
    expect(buildSeries(11, 24, 62, 6)).not.toEqual(buildSeries(23, 24, 62, 6));
  });
});

describe("hud-mock insight band", () => {
  test("quotes the same sleep duration and efficiency as the recovery tab", () => {
    const english = buildInsightText(en.hudMock.insightText);
    expect(english).toContain("7h 42m");
    expect(english).toContain("91%");
    expect(english).toBe("Your sleep was 7h 42m with 91% efficiency. Recovery is on track.");
    const vietnamese = buildInsightText(vi.hudMock.insightText);
    expect(vietnamese).toContain("7h 42m");
    expect(vietnamese).toContain("91%");
    expect(vietnamese).not.toBe(english);
  });

  test("the band copy never cites a cohort or a clinical threshold", () => {
    for (const copy of [en.hudMock, vi.hudMock]) {
      expect(copy.insightText.toLowerCase()).not.toContain("cohort");
      expect(copy.insightText.toLowerCase()).not.toContain("studies");
      expect(copy.insightText.toLowerCase()).not.toContain("nasa");
    }
  });
});

describe("hud-mock formatting", () => {
  test("sleep formatting pads minutes", () => {
    expect(formatSleep(0)).toBe("0h 00m");
    expect(formatSleep(462)).toBe("7h 42m");
    expect(formatSleep(60)).toBe("1h 00m");
  });

  test("signed kcal always shows its sign", () => {
    expect(signedKcal(180)).toBe("+180");
    expect(signedKcal(0)).toBe("+0");
    expect(signedKcal(-40)).toBe("-40");
  });
});
