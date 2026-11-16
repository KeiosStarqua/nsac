import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "../../../shared/i18n/en";
import { applyLiveVitals } from "../../live-health/model/liveHealth";
import { VitalsCard } from "../components/VitalsCard";
import { HUD_MOCK } from "./fixture";

// The `/` console binds its vital rows to the live poll. These assertions pin both halves: the
// fixture is untouched when nothing is live (fallback screenshots must not change), and a live
// payload replaces the values the card actually paints.

function renderVitals(vitalSigns: typeof HUD_MOCK.vitalSigns): string {
  return renderToStaticMarkup(createElement(VitalsCard, { vitalSigns, copy: en.hudMock }));
}

describe("console HUD live binding", () => {
  it("keeps the fixture object (and its markup) when there is no live payload", () => {
    expect(applyLiveVitals(HUD_MOCK.vitalSigns, null)).toBe(HUD_MOCK.vitalSigns);
    expect(applyLiveVitals(HUD_MOCK.vitalSigns, {})).toBe(HUD_MOCK.vitalSigns);

    const html = renderVitals(applyLiveVitals(HUD_MOCK.vitalSigns, {}));
    expect(html).toContain("118/76");
    expect(html).toContain("36.7");
    expect(html).toContain("98");
  });

  it("picks the live readings over the fixture values", () => {
    const bound = applyLiveVitals(HUD_MOCK.vitalSigns, {
      heart_rate_bpm: { value: 74, unit: "bpm", quality: "valid" },
      spo2_pct: { value: 95, unit: "%", quality: "valid" },
      respiratory_rate_bpm: { value: 19, unit: "br/min", quality: "valid" },
      core_temperature_c: { value: 37.24, unit: "°C", quality: "valid" },
      systolic_mmhg: { value: 124, unit: "mmHg", quality: "valid" },
      diastolic_mmhg: { value: 82, unit: "mmHg", quality: "valid" },
    });

    expect(bound.heartRate.value).toBe(74);
    expect(bound.bloodOxygen.value).toBe(95);
    expect(bound.respiratoryRate.value).toBe(19);
    expect(bound.bodyTemperature.value).toBe(37.2);
    expect(bound.bloodPressure.systolic).toBe(124);
    expect(bound.bloodPressure.diastolic).toBe(82);

    const html = renderVitals(bound);
    expect(html).toContain("124/82");
    expect(html).toContain("37.2");
    expect(html).not.toContain("118/76");
    expect(html).not.toContain("36.7");
    // units and sparklines stay the fixture's
    expect(html).toContain("bpm");
    expect(html).toContain("mmHg");
  });

  it("falls back row by row when the payload carries only some metrics", () => {
    const bound = applyLiveVitals(HUD_MOCK.vitalSigns, {
      heart_rate_bpm: { value: 74, unit: "bpm", quality: "valid" },
    });
    expect(bound.heartRate.value).toBe(74);
    expect(bound.bloodPressure.systolic).toBe(118);
    expect(bound.bodyTemperature).toBe(HUD_MOCK.vitalSigns.bodyTemperature);
    expect(renderVitals(bound)).toContain("118/76");
  });
});
