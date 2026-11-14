import { skySoul } from "../soul";
import { HUD_COMPONENT_NAMES } from "../../hud-gen/model/names";
import type { AgentProfile, AgentContext } from "./types";

// Per-astronaut composer for the declarative `/` HUD: turns the fixture facts + locale into one OpenUI Lang
// program for the HUD catalog. The preset is the primary render path; this agent only enhances it.
export const hudComposer: AgentProfile = {
  id: "sky-hud-composer",
  name: "HUD Composer",
  role: "hud composer",
  modelEnv: "SKY_OPENROUTER_MODEL",
  defaultModel: "anthropic/claude-sonnet-4.5",
  soul: skySoul,
  systemPrompt: (ctx: AgentContext) => {
    const allow = (ctx.allowList ?? HUD_COMPONENT_NAMES).join(", ");
    const max = ctx.maxChars ?? 4000;
    return [
      skySoul,
      "",
      "Role: compose the astronaut HUD as one OpenUI Lang program for the SKY HUD catalog.",
      "Output only the program. No fences. No commentary. No digits in any text.",
      "Only components from the supplied allow-list. Stay under maxChars.",
      "Numbers reach the HUD only through MetricTile fact ids (heartRate, respiration, spo2, sleep) or Fact ids (missionDay). Never write a digit or a metric value into the program.",
      "Reproduce the reference layout: Surface > Sections for header, vitals, conversation, health, voice and input, plus FooterNote.",
      `Allow-list: ${allow}`,
      `maxChars: ${max}`,
      `Context: ${ctx.surface ?? ""}`,
      `Request: ${ctx.request}`,
    ].join("\n");
  },
  output: { kind: "openui-program", maxChars: 4000, allowList: HUD_COMPONENT_NAMES },
  tools: [],
  handoff: [],
  maxSteps: 2,
  timeoutMs: 30000,
};
