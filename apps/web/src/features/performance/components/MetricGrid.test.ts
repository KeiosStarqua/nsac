import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MetricGrid } from "./MetricGrid";
import {
  METRIC_ORDER,
  buildMetricTiles,
  unavailableSnapshot,
  type MetricId,
} from "../model/metrics";

const labels = {
  metrics: Object.fromEntries(METRIC_ORDER.map((id) => [id, id])) as Record<MetricId, string>,
  methods: {
    estimated: "est.",
    measured: "measured",
    self_reported: "self-report",
    simulated: "simulated",
  },
};

function render(): string {
  const tiles = buildMetricTiles(unavailableSnapshot("ayla-reyes"), labels, "en");
  return renderToStaticMarkup(
    createElement(MetricGrid, {
      tiles,
      ariaLabel: "Performance metrics, simulated data",
      deltaCaption: "vs 30d",
      simulatedLabel: "Simulated",
    }),
  );
}

describe("MetricGrid", () => {
  it("renders exactly 12 tiles with every metric in priority order", () => {
    const html = render();
    expect((html.match(/data-testid="metric-tile"/g) ?? []).length).toBe(12);
    for (const id of METRIC_ORDER) {
      expect(html).toContain(`data-metric="${id}"`);
    }
    // 12 inline sparklines.
    expect((html.match(/<svg/g) ?? []).length).toBe(12);
  });

  it("marks every tile as simulated", () => {
    const html = render();
    expect((html.match(/Simulated/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });

  it("shows a label, a unit and the 30-day caption", () => {
    const html = render();
    expect(html).toContain(">energy_burned<");
    expect(html).toContain(">kcal<");
    expect(html).toContain("vs 30d");
  });
});
