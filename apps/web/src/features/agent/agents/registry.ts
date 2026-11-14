import { orchestrator } from "./orchestrator";
import { generativeUi } from "./generative-ui";
import { chat } from "./chat";
import { hudComposer } from "./hud-composer";
import type { AgentId, AgentProfile } from "./types";

export const AGENT_REGISTRY: Record<AgentId, AgentProfile> = {
  "sky-orchestrator": orchestrator,
  "sky-generative-ui": generativeUi,
  "sky-chat": chat,
  "sky-hud-composer": hudComposer,
};

export function getAgent(id: AgentId): AgentProfile {
  return AGENT_REGISTRY[id];
}

export function listAgents(): AgentProfile[] {
  return Object.values(AGENT_REGISTRY);
}

export function specialists(): AgentProfile[] {
  return listAgents().filter((a) => a.id !== "sky-orchestrator");
}