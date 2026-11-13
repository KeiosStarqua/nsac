import { describe, it, expect } from "vitest";
import { deviceDensity, supportsVoice, supportsHaptic, isSunlightSafe, capabilitiesFor } from "./devices";

describe("devices helpers", () => {
  it("maps device to density", () => {
    expect(deviceDensity("watch")).toBe("micro");
    expect(deviceDensity("workstation")).toBe("high");
  });
  it("capability predicates", () => {
    expect(supportsVoice("audio")).toBe(true);
    expect(supportsHaptic("watch")).toBe(true);
    expect(isSunlightSafe("eva-hud")).toBe(true);
    expect(capabilitiesFor("tablet").touch).toBe(true);
  });
});