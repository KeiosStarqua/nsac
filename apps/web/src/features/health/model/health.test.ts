import { describe, it, expect } from "vitest";
import { redactEnv, resolveModel, reduceOverall, formatDiagnostics, overallLabel } from "./health";
import type { Check } from "./health";

describe("redactEnv", () => {
  it("never leaks value", () => {
    const secret = "sk-or-v1-supersecret";
    const out = redactEnv(secret);
    expect(JSON.stringify(out)).not.toContain("supersecret");
    expect(out.configured).toBe(true);
    expect(out.length).toBe(secret.length);
  });
  it("unset", () => {
    const out = redactEnv(undefined);
    expect(out.configured).toBe(false);
    expect(out.length).toBe(0);
  });
});

describe("resolveModel", () => {
  it("env over default", () => {
    expect(resolveModel("foo/bar")).toBe("foo/bar");
  });
  it("default when empty", () => {
    expect(resolveModel(undefined)).toBe("thinkingmachines/inkling-2-small:free");
  });
});

describe("reduceOverall", () => {
  it("worst non-unknown", () => {
    const checks: Check[] = [
      { checkId: "a", label: "a", state: "ok", detail: "" },
      { checkId: "b", label: "b", state: "warn", detail: "" },
    ];
    expect(reduceOverall(checks)).toBe("warn");
  });
  it("fail wins", () => {
    const checks: Check[] = [
      { checkId: "a", label: "a", state: "ok", detail: "" },
      { checkId: "b", label: "b", state: "fail", detail: "" },
    ];
    expect(reduceOverall(checks)).toBe("fail");
  });
});

describe("formatDiagnostics", () => {
  it("no secret", () => {
    const secret = "sk-or-v1-testplaceholder";
    const checks: Check[] = [{ checkId: "openrouter.key", label: "k", state: "ok", detail: "configured (length 24)" }];
    const out = formatDiagnostics(checks, "ok", "2026-01-01T00:00:00.000Z");
    expect(out).not.toContain(secret);
  });
});

describe("overallLabel", () => {
  it("maps", () => {
    expect(overallLabel("ok")).toBe("Ready");
    expect(overallLabel("warn")).toBe("Needs attention");
    expect(overallLabel("fail")).toBe("Degraded");
  });
});