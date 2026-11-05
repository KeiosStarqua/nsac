import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { healthLibrary, healthPromptOptions } from "@practice/ui-lib";
import { healthModel } from "./model";
import { getOutbreakStatus, getTrend, whatIf } from "./tools";

const DOMAIN_RULES = `
## How to work
1. Call get-outbreak-status first. Call get-trend when you show a chart.
2. If you propose an action, call what-if for that exact interventionId first and mention its numbers in the rationale.
3. You propose; the astronaut decides. Never say an action was taken.
4. This is a story simulation with toy numbers, not medical advice. Do not give dosing or treatment instructions.
`;

/**
 * The agent writes OpenUI Lang. The prompt is generated from the same library the browser renders with,
 * so the model can only name components that exist and the parser rejects anything else.
 */
export const shipHealthAgent = new Agent({
  id: "ship-health",
  name: "Ship Health Assistant",
  instructions: `${healthLibrary.prompt(healthPromptOptions)}\n${DOMAIN_RULES}`,
  model: () => healthModel(),
  tools: { getOutbreakStatus, getTrend, whatIf },
});

export const mastra = new Mastra({
  agents: { shipHealth: shipHealthAgent },
});
