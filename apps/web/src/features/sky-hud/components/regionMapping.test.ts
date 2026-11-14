import { describe, it, expect } from "vitest";
import { regionLabelKey } from "./regionMapping";

describe("regionLabelKey", () => {
  it("maps regions", () => {
    expect(regionLabelKey("head")).toBe("head");
    expect(regionLabelKey("chest")).toBe("chest");
    expect(regionLabelKey("arm")).toBe("arms");
    expect(regionLabelKey("leg")).toBe("legs");
  });
});