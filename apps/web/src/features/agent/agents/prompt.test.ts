import { describe, it, expect } from "vitest";
import { orchestrator } from "./orchestrator";
import { generativeUi } from "./generative-ui";
import { chat } from "./chat";
import { skySoul } from "../soul";

describe("prompt", () => {
  it("orchestrator contains soul and role", () => {
    const p = orchestrator.systemPrompt({ request: "hi" });
    expect(p).toContain(skySoul.trim().slice(0, 20));
    expect(p).toContain("orchestrator");
  });
  it("generative-ui contains output contract", () => {
    const p = generativeUi.systemPrompt({ request: "hi", allowList: ["Console"], maxChars: 100 });
    expect(p).toContain("No fences");
    expect(p).toContain("Console");
  });
  it("chat forbids software jargon in replies", () => {
    const p = chat.systemPrompt({ request: "hi" });
    expect(p).toMatch(/never name.*(HUD|tool|catalog)/i);
    expect(p).toContain("plain");
  });
  it("chat matches the astronaut's language", () => {
    const p = chat.systemPrompt({ request: "hi" });
    expect(p).toMatch(/Vietnamese in/i);
  });
  it("orchestrator forbids software jargon in replies", () => {
    const p = orchestrator.systemPrompt({ request: "hi" });
    expect(p).toMatch(/never name.*(HUD|tool|catalog)/i);
  });
});