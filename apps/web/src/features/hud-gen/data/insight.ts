// The one deterministic sentence under the centre column. Built from the same fixture the panels
// read, so the band can never quote a different sleep duration or efficiency than the recovery tab.
// No LLM, no cohort values, no citation to this crew's measurements beyond "simulated".
import { format } from "~/shared/i18n";
import { formatSleep, HUD_MOCK, type HudMockFixture } from "./fixture";

export function buildInsightText(
  template: string,
  fixture: HudMockFixture = HUD_MOCK,
): string {
  return format(template, {
    sleep: formatSleep(fixture.recovery.sleepMinutes),
    efficiency: `${fixture.recovery.sleepEfficiencyPct}%`,
  });
}
