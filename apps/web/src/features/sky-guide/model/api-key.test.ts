import { describe, expect, it } from "vitest";
import { KEY_MAX_LENGTH, KEY_MIN_LENGTH, parseOpenRouterKey } from "./api-key";

describe("parseOpenRouterKey", () => {
  it("accepts and trims a plausible key", () => {
    const key = `sk-or-v1-${"a".repeat(40)}`;
    expect(parseOpenRouterKey(`  ${key}\n`)).toBe(key);
  });

  it("rejects too short, too long, empty, or whitespace-broken input", () => {
    expect(parseOpenRouterKey("")).toBeNull();
    expect(parseOpenRouterKey("   ")).toBeNull();
    expect(parseOpenRouterKey("a".repeat(KEY_MIN_LENGTH - 1))).toBeNull();
    expect(parseOpenRouterKey("a".repeat(KEY_MAX_LENGTH + 1))).toBeNull();
    expect(parseOpenRouterKey(`${"a".repeat(KEY_MIN_LENGTH)} ${"b".repeat(8)}`)).toBeNull();
    expect(parseOpenRouterKey(`${"a".repeat(KEY_MIN_LENGTH)}\n${"b".repeat(4)}`)).toBeNull();
  });

  it("accepts exactly the bounds", () => {
    expect(parseOpenRouterKey("a".repeat(KEY_MIN_LENGTH))).toBe("a".repeat(KEY_MIN_LENGTH));
    expect(parseOpenRouterKey("a".repeat(KEY_MAX_LENGTH))).toBe("a".repeat(KEY_MAX_LENGTH));
  });
});
