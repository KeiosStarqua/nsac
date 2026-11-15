import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "../../../shared/i18n/en";
import { LIVE_HEALTH_INITIAL, type LiveHealthPayload, type LiveHealthState } from "../model/liveHealth";
import { LiveVitalsStrip } from "./LiveVitalsStrip";

const LIVE: LiveHealthPayload = {
  ok: true,
  live: true,
  updatedAt: "2026-11-16T09:41:00.000Z",
  source: "sim",
  metrics: {
    heart_rate_bpm: { value: 71, unit: "bpm", quality: "valid" },
    spo2_pct: { value: 97.6, unit: "%", quality: "valid" },
    respiratory_rate_bpm: { value: 15, unit: "br/min", quality: "valid" },
    core_temperature_c: { value: 36.82, unit: "°C", quality: "valid" },
    systolic_mmhg: { value: 121, unit: "mmHg", quality: "valid" },
    diastolic_mmhg: { value: 79, unit: "mmHg", quality: "valid" },
    activity_counts: { value: 812, unit: "cts", quality: "estimated" },
  },
};

function state(overrides: Partial<LiveHealthState> = {}): LiveHealthState {
  return { ...LIVE_HEALTH_INITIAL, settled: true, ...overrides };
}

function render(value: LiveHealthState): string {
  return renderToStaticMarkup(createElement(LiveVitalsStrip, { state: value, copy: en.live, locale: "en" }));
}

describe("LiveVitalsStrip", () => {
  it("renders the live state: label, pulsing dot, timestamp and one card per present metric", () => {
    const html = render(state({ data: LIVE, live: true, source: "sim", updatedAt: LIVE.updatedAt }));
    expect(html).toContain('data-state="live"');
    expect(html).toContain(en.live.visibleLive);
    expect(html).toContain("09:41 UTC");
    expect((html.match(/data-testid="live-vital-card"/g) ?? []).length).toBe(6);
    for (const id of [
      "heart_rate_bpm",
      "spo2_pct",
      "respiratory_rate_bpm",
      "core_temperature_c",
      "blood_pressure",
      "activity_counts",
    ]) {
      expect(html).toContain(`data-vital="${id}"`);
    }
    // values are announced politely; the dot is decorative
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("animate-pulse");
    expect(html).toContain("121/79");
    expect(html).toContain("36.8");
  });

  it("renders the historical state for a seed payload, without the pulsing dot", () => {
    const html = render(
      state({ data: { ...LIVE, live: false, source: "seed" }, live: false, source: "seed", updatedAt: LIVE.updatedAt }),
    );
    expect(html).toContain('data-state="historical"');
    expect(html).toContain(en.live.historicalLabel);
    expect(html).not.toContain("animate-pulse");
    expect((html.match(/data-testid="live-vital-card"/g) ?? []).length).toBe(6);
  });

  it("renders the offline state when no payload ever arrived", () => {
    const html = render(state({ data: null }));
    expect(html).toContain('data-state="offline"');
    expect(html).toContain(en.live.offlineLabel);
    expect(html).not.toContain('data-testid="live-vital-card"');
    expect(html).not.toContain("animate-pulse");
  });

  it("stays hidden until the first read settles", () => {
    expect(render(LIVE_HEALTH_INITIAL)).toBe("");
  });
});
