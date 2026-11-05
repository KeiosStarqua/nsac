import { RequestContext } from "@mastra/core/request-context";
import { parseInterventions, runScenario } from "@practice/sim";

/** What the web app sends with each question. The sim is replayed from this, so no state is stored. */
export interface AgentScenario {
  seed: number;
  day: number;
  /** Confirmed interventions in compact string form, e.g. "4:masks". */
  interventions: string[];
}

const KEY = "scenario";

export function makeRequestContext(scenario: AgentScenario): RequestContext {
  const ctx = new RequestContext();
  ctx.set(KEY, scenario);
  return ctx;
}

export function readScenario(ctx: RequestContext | undefined): AgentScenario {
  const value = ctx?.get(KEY) as AgentScenario | undefined;
  if (!value) throw new Error("Missing scenario in request context");
  return value;
}

export function replay(scenario: AgentScenario, extra: string[] = [], toDay = scenario.day) {
  return runScenario(
    {
      config: { seed: scenario.seed },
      interventions: parseInterventions([...scenario.interventions, ...extra]),
    },
    toDay,
  );
}
