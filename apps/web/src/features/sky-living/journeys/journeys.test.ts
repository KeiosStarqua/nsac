import { describe, it, expect } from "vitest";
import { classifyIntent } from "./IntentBar";

describe("classifyIntent", () => {
  it("maps tired", () => expect(classifyIntent("tired")).toBe("why-tired"));
  it("maps exercise", () => expect(classifyIntent("tập")).toBe("exercise-guidance"));
  it("maps emergency", () => expect(classifyIntent("emergency")).toBe("emergency"));
  it("maps earth", () => expect(classifyIntent("earth consult")).toBe("earth-consult"));
  it("maps sleep", () => expect(classifyIntent("ngủ")).toBe("sleep-report"));
  it("default unknown", () => expect(classifyIntent("hello")).toBe("unknown"));
});
