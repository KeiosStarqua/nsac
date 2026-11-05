import { advanceDay, applyIntervention, createOutbreak, summarize } from "./outbreak";
import type { DaySummary, Intervention, OutbreakConfig, OutbreakState } from "./types";

export interface Scenario {
  config?: Partial<OutbreakConfig>;
  interventions?: Intervention[];
}

export interface ScenarioRun {
  state: OutbreakState;
  /** One summary per day, index = day (0..toDay). */
  series: DaySummary[];
}

export const MAX_DAY = 60;

function clampDay(day: number): number {
  return Math.max(0, Math.min(MAX_DAY, Math.floor(day)));
}

/**
 * Replay a scenario from day 0 and return the state of every day (index = day).
 * Interventions apply at the start of their day (day <= 1 applies on day 1).
 * Same inputs always give the same output.
 */
export function runTimeline(scenario: Scenario, toDay: number): OutbreakState[] {
  const target = clampDay(toDay);
  const interventions = [...(scenario.interventions ?? [])].sort((a, b) => a.day - b.day);
  let state = createOutbreak(scenario.config);
  const states: OutbreakState[] = [state];

  for (let d = 1; d <= target; d++) {
    for (const iv of interventions) {
      if (iv.day === d || (d === 1 && iv.day < 1)) state = applyIntervention(state, iv, d);
    }
    state = advanceDay(state);
    states.push(state);
  }
  return states;
}

export function runScenario(scenario: Scenario, toDay: number): ScenarioRun {
  const states = runTimeline(scenario, toDay);
  return { state: states[states.length - 1]!, series: states.map(summarize) };
}
