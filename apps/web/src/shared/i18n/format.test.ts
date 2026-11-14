import { describe, expect, test } from "vitest";
import { en } from "./en";
import { format } from "./format";
import { vi } from "./vi";

describe("format", () => {
  test("replaces known placeholders", () => {
    expect(format("Continue as {name}", { name: "Ayla Reyes" })).toBe("Continue as Ayla Reyes");
    expect(format("Chào buổi sáng, {name}.", { name: "Ayla" })).toBe("Chào buổi sáng, Ayla.");
  });

  test("leaves unknown placeholders untouched", () => {
    expect(format("Hello {name}, {other}", { name: "Ayla" })).toBe("Hello Ayla, {other}");
  });
});

describe("astronaut copy", () => {
  test("both locales carry the required strings", () => {
    for (const copy of [en, vi]) {
      expect(copy.astronaut.title.length).toBeGreaterThan(0);
      expect(copy.astronaut.confirm).toContain("{name}");
      expect(copy.astronaut.greeting).toContain("{name}");
    }
    expect(en.astronaut.footer).toBe("Simulated crew · Demonstration only · Not medical advice");
  });

  test("locales expose the same keys", () => {
    expect(Object.keys(vi.astronaut).sort()).toEqual(Object.keys(en.astronaut).sort());
  });
});
