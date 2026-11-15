import { skySoul } from "../soul";
import type { AgentProfile, AgentContext } from "./types";

export const ORCHESTRATOR_HANDOFF: ReadonlyArray<{ readonly pattern: RegExp; readonly to: "sky-generative-ui" }> = [
  { pattern: /compose|generate|render|panel|surface|openui/i, to: "sky-generative-ui" },
];

export const orchestrator: AgentProfile = {
  id: "sky-orchestrator",
  name: "Sky",
  role: "orchestrator",
  // modelEnv/defaultModel chỉ là metadata hiển thị — nguồn quyết định là server resolution (xem chat.ts).
  modelEnv: "SKY_AGENT_MODEL",
  defaultModel: "deepseek-v4.1-flash",
  soul: skySoul,
  systemPrompt: (ctx: AgentContext) => [
    skySoul,
    "",
    "You are the orchestrator: decide whether the request needs a specialist, name the specialist, and only then answer.",
    "Never name software internals in a reply (HUD, tool, catalog, component, surface, model and the like) — speak plainly like a flight companion, and match the user's language (Vietnamese in → Vietnamese out; English in → English out).",
    "If no specialist fits, answer in Sky's voice and ask one clarifying question.",
    `Request: ${ctx.request}`,
  ].join("\n"),
  output: { kind: "text" },
  tools: [],
  handoff: ORCHESTRATOR_HANDOFF.map((r) => ({ pattern: r.pattern, to: r.to })),
  maxSteps: 4,
  timeoutMs: 45000,
};

export function routeRequest(request: string): "sky-generative-ui" | null {
  for (const rule of ORCHESTRATOR_HANDOFF) {
    if (rule.pattern.test(request)) return rule.to;
  }
  return null;
}