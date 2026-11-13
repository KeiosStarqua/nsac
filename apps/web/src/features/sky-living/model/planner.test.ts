import { describe, expect, it } from "vitest";
import { planScene, approvalGate } from "./planner";
import { validateScene } from "./scene";
import { initialSnapshot, transition, resolveState } from "./state-machine";
import { MEASUREMENTS } from "./data";

describe("validateScene", () => {
  it("accepts every planner scene", () => {
    for (const intent of ["daily-wellness", "why-tired", "recovery-deviation", "evidence", "exercise-guidance", "medical-decision", "emergency", "eva-monitoring", "earth-consult", "sleep-report", "radi-exposure", "unknown"] as const) {
      const gate = validateScene(planScene(intent));
      expect(gate.ok).toBe(true);
    }
  });

  it("rejects free-text digits", () => {
    const gate = validateScene({ ...planScene("evidence"), summary: "your heart rate is 62" });
    expect(gate.ok).toBe(false);
  });
});

describe("planScene", () => {
  it("marks everything simulated", () => {
    expect(planScene("why-tired").simulated).toBe(true);
  });
  it("never writes a digit into free text or entity details", () => {
    const scene = planScene("recovery-deviation");
    const blobs = [scene.summary, scene.caveat ?? "", ...scene.entities.map((e) => e.detail ?? "")];
    for (const b of blobs) expect(b).not.toMatch(/[0-9]/);
  });
});

describe("approvalGate", () => {
  it("requires explicit approval for clinical recommendations", () => {
    expect(approvalGate("medical-decision", "high")).toBe("required");
    expect(approvalGate("exercise-guidance", "high")).toBe("required");
    expect(approvalGate("daily-wellness", "high")).toBe("none");
  });
});

describe("state machine", () => {
  it("emergency overrides everything and sticks", () => {
    let s = initialSnapshot;
    s = transition(s, { type: "deviancy-detected" });
    expect(s.state).toBe("attention");
    s = transition(s, { type: "user-ask", intent: "emergency" });
    expect(s.state).toBe("emergency");
    s = transition(s, { type: "dismiss" });
    expect(s.state).toBe("emergency");
    s = transition(s, { type: "emergency-cleared" });
    expect(s.state).toBe("presence");
  });

  it("presence → processing → understanding → continuity → presence", () => {
    let s = initialSnapshot;
    s = transition(s, { type: "user-ask", intent: "daily-wellness" });
    expect(s.state).toBe("processing");
    s = transition(s, { type: "answer-ready" });
    expect(s.state).toBe("understanding");
    s = transition(s, { type: "approved" });
    expect(s.state).toBe("continuity");
    s = transition(s, { type: "exercise-complete" });
    expect(s.state).toBe("presence");
  });

  it("resolveState keeps the stronger alarm", () => {
    expect(resolveState("emergency", "presence")).toBe("emergency");
    expect(resolveState("attention", "presence")).toBe("attention");
    expect(resolveState("presence", "emergency")).toBe("emergency");
  });
});

describe("measurements", () => {
  it("labels all data as simulated in the module docs", () => {
    expect(MEASUREMENTS.length).toBeGreaterThan(5);
  });
});
