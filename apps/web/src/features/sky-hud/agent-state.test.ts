import { describe, expect, it } from "vitest";
import {
  AGENT_STATES,
  AGENT_STATE_BALL,
  agentStateForVoiceChat,
  agentStateForVoicePhase,
} from "./agent-state";
import type { VoicePhase } from "./types";

describe("AGENT_STATE_BALL", () => {
  it("covers every agent state with a pinned particle count", () => {
    expect(Object.keys(AGENT_STATE_BALL).sort()).toEqual([...AGENT_STATES].sort());
    for (const state of AGENT_STATES) {
      expect(AGENT_STATE_BALL[state].particleCount).toBe(15000);
      expect(AGENT_STATE_BALL[state].speed).toBeGreaterThan(0);
    }
  });

  it("gives every non-ambient state a visibly distinct recipe from idle", () => {
    const idle = AGENT_STATE_BALL.idle;
    for (const state of AGENT_STATES) {
      if (state === "idle") continue;
      const tune = AGENT_STATE_BALL[state];
      const distinct =
        tune.preset !== idle.preset ||
        tune.speed !== idle.speed ||
        tune.glow !== idle.glow ||
        tune.sparks !== idle.sparks;
      expect(distinct, `state ${state} must differ from idle`).toBe(true);
    }
  });
});

describe("agentStateForVoicePhase", () => {
  const cases: Array<[VoicePhase, string]> = [
    ["idle", "idle"],
    ["requesting_permission", "connecting"],
    ["listening", "listening"],
    ["transcribing", "thinking"],
    ["thinking", "thinking"],
    ["speaking", "speaking"],
    ["offline", "error"],
    ["error", "error"],
  ];
  it.each(cases)("%s → %s", (phase, expected) => {
    expect(agentStateForVoicePhase(phase)).toBe(expected);
  });
});

describe("agentStateForVoiceChat", () => {
  it("maps the notice over every other signal (the ball must warn, not hum on)", () => {
    expect(agentStateForVoiceChat("live", "speaking", "failed")).toBe("error");
    expect(agentStateForVoiceChat("live", "listening", "notConfigured")).toBe("error");
    expect(agentStateForVoiceChat("connecting", "listening", "failed")).toBe("error");
    expect(agentStateForVoiceChat("idle", "listening", "notConfigured")).toBe("error");
  });

  it("maps status/mode across the mic flow, notice-free", () => {
    expect(agentStateForVoiceChat("idle", "listening", null)).toBe("idle");
    expect(agentStateForVoiceChat("connecting", "listening", null)).toBe("connecting");
    expect(agentStateForVoiceChat("live", "listening", null)).toBe("listening");
    expect(agentStateForVoiceChat("live", "thinking", null)).toBe("thinking");
    expect(agentStateForVoiceChat("live", "speaking", null)).toBe("speaking");
  });

  it("lets a live thinking state clear into speaking (the backend answers the turn)", () => {
    expect(agentStateForVoiceChat("live", "thinking", null)).toBe("thinking");
    expect(agentStateForVoiceChat("live", "speaking", null)).toBe("speaking");
  });

  it("keeps the notice precedence over thinking", () => {
    expect(agentStateForVoiceChat("live", "thinking", "failed")).toBe("error");
    expect(agentStateForVoiceChat("live", "thinking", "notConfigured")).toBe("error");
  });
});
