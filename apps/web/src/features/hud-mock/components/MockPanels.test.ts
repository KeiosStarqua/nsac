import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "~/shared/i18n/en";
import { HUD_MOCK, formatSleep } from "../model/fixture";
import { buildInsightText } from "../model/insight";
import { InsightBand } from "./InsightBand";
import { MiniCards, ReadinessCard, ReadinessDetail } from "./ReadinessPanel";
import { ProfileCard } from "./ProfileCard";
import { TrendsCard } from "./TrendsCard";
import { VitalsCard } from "./VitalsCard";

const copy = en.hudMock;

function render(): string {
  return renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(ProfileCard, {
        name: "Ayla Reyes",
        role: copy.roles.commander,
        initials: "AR",
        avatarSrc: "/astronauts/ayla-reyes.png",
        copy,
        changeLabel: "Change astronaut",
        onChange: () => {},
      }),
      createElement(VitalsCard, { vitalSigns: HUD_MOCK.vitalSigns, copy }),
      createElement(TrendsCard, { trends: HUD_MOCK.quickTrends, copy }),
      createElement(ReadinessCard, { readiness: HUD_MOCK.readiness, copy }),
      createElement(ReadinessDetail, {
        fixture: HUD_MOCK,
        copy,
        holo: createElement("div", { "data-testid": "holo-stub" }),
      }),
      createElement(MiniCards, { cards: HUD_MOCK.cards, copy }),
      createElement(InsightBand, {
        text: buildInsightText(copy.insightText),
        kicker: copy.insightKicker,
        ariaLabel: copy.insightOpen,
        onOpen: () => {},
      }),
    ),
  );
}

describe("hud-mock console — render smoke", () => {
  test("renders every region without throwing", () => {
    const html = render();
    for (const marker of [
      'data-testid="mock-profile"',
      'data-testid="mock-vitals"',
      'data-testid="mock-trends"',
      'data-testid="mock-readiness"',
      'data-testid="mock-readiness-detail"',
      'data-testid="mock-mini-cards"',
      'data-testid="mock-insight"',
    ]) {
      expect(html).toContain(marker);
    }
  });

  test("profile carries the simulated-telemetry label, roster name, role and the avatar PNG", () => {
    const html = render();
    expect(html).toContain(copy.profileSimulated);
    expect(html).toContain("Ayla Reyes");
    expect(html).toContain(copy.roles.commander);
    expect(html).toContain('src="/astronauts/ayla-reyes.png"');
    expect(html).toContain(copy.avatarAlt.replace("{name}", "Ayla Reyes"));
  });

  test("five vital rows with the fixture values and five inline sparklines", () => {
    const html = render();
    expect((html.match(/data-vital="/g) ?? []).length).toBe(5);
    expect(html).toContain("62");
    expect(html).toContain("118/76");
    expect(html).toContain("16");
    expect(html).toContain("98");
    expect(html).toContain("36.7");
    expect(html).toContain("<small>bpm</small>");
    expect(html).toContain("<small>mmHg</small>");
    expect(html).toContain("<small>breaths/min</small>");
    expect(html).toContain("<small>°C</small>");
    // vitals (5) + trends (1) sparklines
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  test("quick trends show the same sleep and activity numbers as the rest of the page", () => {
    const html = render();
    expect(html).toContain(formatSleep(HUD_MOCK.quickTrends.sleepMinutes));
    expect(html).toContain("48 min");
    expect(html).toContain("62 avg");
    expect((html.match(/data-trend="/g) ?? []).length).toBe(3);
  });

  test("readiness gauge renders its score, status, guidance and both aria labels", () => {
    const html = render();
    expect(html).toContain("86");
    expect(html).toContain("/100");
    expect(html).toContain("96 /100");
    expect(html).toContain(copy.readinessStable);
    expect(html).toContain(copy.readinessGuidance);
    expect(html).toContain("Overall readiness 86 out of 100, simulated");
    expect(html).toContain('stroke="url(#hudMockReadiness)"');
  });

  test("four tabs render, Body is selected, and the body panel lists four rows", () => {
    const html = render();
    expect((html.match(/role="tab"/g) ?? []).length).toBe(4);
    expect((html.match(/aria-selected="true"/g) ?? []).length).toBe(1);
    expect(html).toContain('id="hudMockPanel-body"');
    expect(html).toContain('data-active-tab="body"');
    expect((html.match(/data-row="/g) ?? []).length).toBe(4);
    for (const value of ["72.4 kg", "32.1 kg", "2.8 kg", "18.5 %"]) {
      expect(html).toContain(value);
    }
    expect(html).toContain(copy.panelBody);
  });

  test("the three mini cards carry activity, energy burned and energy intake with the balance chip", () => {
    const html = render();
    expect((html.match(/data-card="/g) ?? []).length).toBe(3);
    expect(html).toContain("48");
    expect(html).toContain("2,340");
    expect(html).toContain("2,520");
    expect(html).toContain("Balance: +180 kcal");
    expect(html).toContain("▲ +12%");
  });

  test("insight band quotes the fixture sleep and offers the chevron", () => {
    const html = render();
    expect(html).toContain("Your sleep was 7h 42m with 91% efficiency. Recovery is on track.");
    expect(html).toContain(copy.insightKicker);
    expect(html).toContain("›");
  });
});
