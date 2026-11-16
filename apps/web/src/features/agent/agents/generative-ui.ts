import { skySoul } from "../soul";
import { REACT_BITS_NAMES } from "../catalog/library";
import { OPENUI_SYNTAX } from "./openui-syntax";
import type { AgentProfile, AgentContext } from "./types";

export const generativeUi: AgentProfile = {
  id: "sky-generative-ui",
  name: "Generative UI",
  role: "openui spec generator",
  // modelEnv/defaultModel chỉ là metadata hiển thị — nguồn quyết định là server resolution (xem chat.ts).
  modelEnv: "SKY_AGENT_MODEL",
  defaultModel: "deepseek-v4.1-flash",
  soul: skySoul,
  systemPrompt: (ctx: AgentContext) => {
    const allow = (ctx.allowList ?? []).join(", ");
    const max = ctx.maxChars ?? 4000;
    return [
      skySoul,
      "",
      "Role: turn a request plus a surface description into an OpenUI Lang program.",
      "Output only the program. No fences. No commentary. No digits in any text.",
      "Only components from the supplied allow-list. Stay under maxChars.",
      `Allow-list: ${allow}`,
      OPENUI_SYNTAX,
      `maxChars: ${max}`,
      `Surface: ${ctx.surface ?? ""}`,
      `Request: ${ctx.request}`,
    ].join("\n");
  },
  output: { kind: "openui-program", maxChars: 4000, allowList: REACT_BITS_NAMES },
  tools: [],
  handoff: [],
  maxSteps: 2,
  timeoutMs: 30000,
};