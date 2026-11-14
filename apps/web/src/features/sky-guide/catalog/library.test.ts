import { describe, it, expect } from "vitest";
import { skyLibrary } from "./library";

describe("skyLibrary", () => {
  it("has 48 components", () => {
    expect(skyLibrary.length).toBe(48);
  });
  it("slugs unique", () => {
    const slugs = skyLibrary.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
