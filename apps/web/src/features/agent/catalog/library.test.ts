import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { reactBitsLibrary, REACT_BITS_NAMES } from "./library";

describe("react bits catalog", () => {
  it("registers all 48+ components", () => {
    expect(REACT_BITS_NAMES.length).toBeGreaterThanOrEqual(48);
  });
  it("has unique names", () => {
    expect(new Set(REACT_BITS_NAMES).size).toBe(REACT_BITS_NAMES.length);
  });
});
