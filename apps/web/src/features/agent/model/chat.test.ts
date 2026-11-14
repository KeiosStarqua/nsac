import { describe, it, expect } from "vitest";
import { sanitizeAstronautId, validateMessage, trimTranscript } from "./chat";

describe("sanitizeAstronautId", () => {
  it("rejects path traversal", () => { expect(sanitizeAstronautId("../x")).toBeNull(); });
  it("rejects spaces and uppercase", () => { expect(sanitizeAstronautId("A B")).toBeNull(); });
  it("rejects empty", () => { expect(sanitizeAstronautId("")).toBeNull(); });
  it("rejects >64", () => { expect(sanitizeAstronautId("a".repeat(65))).toBeNull(); });
  it("lowercases", () => { expect(sanitizeAstronautId("ABC")).toBe("abc"); });
});

describe("validateMessage", () => {
  it("trims", () => { expect(validateMessage("  hi  ")).toBe("hi"); });
  it("rejects empty", () => { expect(validateMessage("   ")).toBeNull(); });
  it("rejects >500", () => { expect(validateMessage("a".repeat(501))).toBeNull(); });
});

describe("trimTranscript", () => {
  it("keeps newest 40", () => {
    const arr = Array.from({ length: 45 }, (_, i) => ({ role: "user" as const, text: String(i), at: "" }));
    const r = trimTranscript(arr);
    expect(r.length).toBe(40);
    expect(r[0]?.text).toBe("5");
  });
  it("returns same when short", () => {
    const arr = [{ role: "user" as const, text: "x", at: "" }];
    expect(trimTranscript(arr)).toBe(arr);
  });
});