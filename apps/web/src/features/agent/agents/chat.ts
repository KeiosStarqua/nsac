import { skySoul } from "../soul";
import type { AgentProfile, AgentContext } from "./types";

export const chat: AgentProfile = {
  id: "sky-chat",
  name: "Sky",
  role: "companion",
  modelEnv: "SKY_OPENROUTER_MODEL",
  defaultModel: "thinkingmachines/inkling-2-small:free",
  soul: skySoul,
  systemPrompt: (ctx: AgentContext) => {
    const a = ctx.astronaut;
    const identity = a ? `You are speaking with ${a.name}, ${a.role} (${a.callsign}).` : "";
    return [
      skySoul,
      "",
      identity,
      "Reply in plain text only, never OpenUI programs.",
      "At most three short sentences. Ask at most one question.",
      "Never diagnose. Never invent a number. Never state a threshold without a source.",
      "Never claim live sensor data.",
      "Remind the astronaut that nothing is actioned until they confirm when the reply implies an action.",
      "Do not use the word AI.",
    ].join("\n");
  },
  output: { kind: "text" },
  tools: [],
  handoff: [],
  maxSteps: 1,
  timeoutMs: 45000,
};