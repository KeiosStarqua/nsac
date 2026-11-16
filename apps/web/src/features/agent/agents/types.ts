export type AgentId =
  | "sky-orchestrator"
  | "sky-generative-ui"
  | "sky-chat"
  | "sky-hud-composer"
  | "sky-medical-officer";

export type OutputContract =
  | { readonly kind: "text" }
  | { readonly kind: "openui-program"; readonly maxChars: number; readonly allowList: readonly string[] }
  | { readonly kind: "clinical-case-summary"; readonly maxChars: number };

export type HandoffRule = { readonly pattern: RegExp; readonly to: AgentId };

export type AgentContext = {
  readonly request: string;
  readonly surface?: string;
  readonly allowList?: readonly string[];
  readonly maxChars?: number;
  readonly astronaut?: { readonly name: string; readonly role: string; readonly callsign: string };
  /**
   * Sanitized roster id of the astronaut the turn belongs to. Additive: the pi core ignores it
   * (its system prompt reads `astronaut`), the Mastra core uses it as the memory thread id
   * (`astronaut:<id>`, fallback `global`).
   */
  readonly astronautId?: string;
};

export type AgentProfile = {
  readonly id: AgentId;
  readonly name: string;
  readonly role: string;
  readonly modelEnv: string;
  readonly defaultModel: string;
  readonly soul: string;
  readonly systemPrompt: (ctx: AgentContext) => string;
  readonly output: OutputContract;
  readonly tools: readonly string[];
  readonly handoff: readonly HandoffRule[];
  readonly maxSteps: number;
  readonly timeoutMs: number;
};