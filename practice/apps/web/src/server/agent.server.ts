// Server-only: Mastra, Ollama and the briefing builder never reach the browser.
import { askShipAgent, buildBriefing, proposeNext, type AgentScenario } from "@practice/agent";
import type { BriefingPayload } from "~/shared/scenario/types";

export function briefing(scenario: AgentScenario): BriefingPayload {
  return {
    text: buildBriefing(scenario),
    source: "built-in",
    proposalId: proposeNext(scenario)?.interventionId ?? null,
  };
}

export { askShipAgent };
export type { AgentScenario };
