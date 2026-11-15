import { describe, expect, it } from "vitest";
import { GO_CATALOG } from "./goCatalog";

// Hợp đồng cho snapshot tĩnh của OpenCode Go picker (/admin). Không assert số lượng —
// đó là thứ duy nhất thay đổi giữa các lần SDK bump và sẽ gây churn vô nghĩa trong CI.
describe("goCatalog", () => {
  it("is not empty", () => {
    expect(GO_CATALOG.length).toBeGreaterThan(0);
  });

  it("has unique ids", () => {
    const ids = GO_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains the Sky default model deepseek-v4.1-flash", () => {
    const flash = GO_CATALOG.find((m) => m.id === "deepseek-v4.1-flash");
    expect(flash).toBeDefined();
    expect(flash?.inputCostPerMTok).toBe(0.15);
    expect(flash?.outputCostPerMTok).toBe(0.6);
  });

  it("has well-formed entries (model id, positive context/maxTokens, sane costs)", () => {
    const MODEL_ID_REGEX = /^[a-z0-9][a-z0-9/_:.-]{0,199}$/;
    for (const m of GO_CATALOG) {
      expect(MODEL_ID_REGEX.test(m.id), `bad id ${m.id}`).toBe(true);
      expect(m.name.trim().length, `empty name for ${m.id}`).toBeGreaterThan(0);
      expect(Number.isFinite(m.inputCostPerMTok)).toBe(true);
      expect(Number.isFinite(m.outputCostPerMTok)).toBe(true);
      expect(m.inputCostPerMTok).toBeGreaterThan(0);
      expect(m.outputCostPerMTok).toBeGreaterThan(0);
      expect(Number.isInteger(m.contextWindow)).toBe(true);
      expect(Number.isInteger(m.maxTokens)).toBe(true);
      expect(m.contextWindow).toBeGreaterThan(0);
      expect(m.maxTokens).toBeGreaterThan(0);
    }
  });

  it("excludes the free tier (external clients get 403)", () => {
    expect(GO_CATALOG.some((m) => m.inputCostPerMTok === 0 || m.outputCostPerMTok === 0)).toBe(false);
  });

  it("is sorted by id (stable diffs)", () => {
    const ids = GO_CATALOG.map((m) => m.id);
    expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(ids);
  });
});
