import { describe, it, expect } from "vitest";
import { assistantText, isProviderError } from "./provider-result";

describe("assistantText", () => {
  it("joins text blocks and skips others", () => {
    const m = { content: [{ type: "text", text: "a" }, { type: "thinking", text: "x" }, { type: "text", text: "b" }, { type: "toolcall" }] };
    expect(assistantText(m)).toBe("ab");
  });
  it("empty for []", () => { expect(assistantText({ content: [] })).toBe(""); });
  it("empty for undefined", () => { expect(assistantText({})).toBe(""); });
  it("tolerates malformed", () => { expect(assistantText({ content: [42, null, { type: "text" }] })).toBe(""); });
});

describe("isProviderError", () => {
  it("true only for error", () => {
    expect(isProviderError({ stopReason: "error" })).toBe(true);
    expect(isProviderError({ stopReason: "stop" })).toBe(false);
    expect(isProviderError({ stopReason: "length" })).toBe(false);
    expect(isProviderError({})).toBe(false);
  });
});