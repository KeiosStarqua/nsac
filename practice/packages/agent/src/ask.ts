import { buildBriefing } from "./briefing";
import { shipHealthAgent } from "./agent";
import { ollamaStatus } from "./model";
import { makeRequestContext, type AgentScenario } from "./scenario-context";

export interface AskResult {
  source: "ollama" | "built-in";
  /** Why the built-in briefing was used, if it was. */
  reason?: string;
  stream: AsyncIterable<string>;
}

async function* chunks(text: string, size = 24): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
    await new Promise((r) => setTimeout(r, 12));
  }
}

/**
 * Ask the ship health agent. Streams OpenUI Lang text.
 * If Ollama is offline or the model is missing, streams the deterministic briefing instead.
 */
export async function askShipAgent(question: string, scenario: AgentScenario): Promise<AskResult> {
  const status = await ollamaStatus();
  if (!status.online) {
    return { source: "built-in", reason: "Ollama is not running on this machine.", stream: chunks(buildBriefing(scenario)) };
  }
  if (!status.modelInstalled) {
    return {
      source: "built-in",
      reason: `Model "${status.model}" is not installed. Run: ollama pull ${status.model}`,
      stream: chunks(buildBriefing(scenario)),
    };
  }

  const output = await shipHealthAgent.stream(
    [{ role: "user", content: `Day ${scenario.day}. ${question}` }],
    { requestContext: makeRequestContext(scenario), maxSteps: 6 },
  );
  return { source: "ollama", stream: output.textStream };
}
