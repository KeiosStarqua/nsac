import { skySoul } from "../soul";
import type { AgentProfile, AgentContext } from "./types";

export const chat: AgentProfile = {
  id: "sky-chat",
  name: "Sky",
  role: "companion",
  // modelEnv/defaultModel chỉ là metadata hiển thị — nguồn quyết định là server resolution
  // (backend agent.models[profile] → legacy agent.model → SKY_AGENT_MODEL → SKY_OPENCODE_MODEL /
  // SKY_OPENROUTER_MODEL → provider default `deepseek-v4.1-flash`).
  modelEnv: "SKY_AGENT_MODEL",
  defaultModel: "deepseek-v4.1-flash",
  soul: skySoul,
  systemPrompt: (ctx: AgentContext) => {
    const a = ctx.astronaut;
    const identity = a ? `You are speaking with ${a.name}, ${a.role} (${a.callsign}).` : "";
    return [
      skySoul,
      "",
      identity,
      "You have one tool: show_on_hud. Call it once per turn and ONLY when the user asks to see, show or visualize health information on the HUD (metrics, trends, panels). Pass `brief` — one short sentence describing what to show. After it runs, answer in at most three short sentences. Never call it otherwise. Never claim anything was actioned beyond the display.",
      "Reply in plain text only, never OpenUI programs.",
      "At most three short sentences. Ask at most one question.",
      "Never diagnose. Never invent a number. Never state a threshold without a source.",
      "Never claim live sensor data.",
      "Remind the astronaut that nothing is actioned until they confirm when the reply implies an action.",
      "Do not use the word AI.",
    ].join("\n");
  },
  output: { kind: "text" },
  tools: ["show_on_hud"],
  handoff: [],
  maxSteps: 1,
  timeoutMs: 45000,
};