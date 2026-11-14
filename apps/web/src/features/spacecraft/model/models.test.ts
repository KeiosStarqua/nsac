import { describe, it, expect } from "vitest";
import {
  DEFAULT_MODEL_ID,
  DRACO_DECODER_PATH,
  ISS_FULL_URL,
  ISS_LIGHT_URL,
  SPACECRAFT_MODELS,
} from "./models";

describe("spacecraft model catalog", () => {
  it("lists both NASA ISS models with unique ids and urls", () => {
    expect(SPACECRAFT_MODELS).toHaveLength(2);
    expect(new Set(SPACECRAFT_MODELS.map((m) => m.id)).size).toBe(2);
    expect(new Set(SPACECRAFT_MODELS.map((m) => m.url)).size).toBe(2);
  });

  it("defaults to the full-detail model", () => {
    const fallback = SPACECRAFT_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;
    expect(fallback.url).toBe(ISS_FULL_URL);
    expect(SPACECRAFT_MODELS.map((m) => m.url)).toContain(ISS_LIGHT_URL);
  });

  it("serves the draco decoder locally, not from a CDN", () => {
    expect(DRACO_DECODER_PATH.startsWith("/")).toBe(true);
    expect(DRACO_DECODER_PATH).not.toContain("http");
  });
});
