import { describe, expect, it } from "vitest";
import { BEDROCK_CATALOG } from "./bedrockCatalog";
import { en } from "~/shared/i18n/en";
import { vi } from "~/shared/i18n/vi";

// Hợp đồng cho snapshot tĩnh Bedrock (/admin picker + allowlist khi lưu). Không assert
// thêm entry mới — danh sách chỉ đổi khi re-verify live Converse; khi đó cập nhật cả
// comment nguồn trong bedrockCatalog.ts và price nếu giá account đổi.
describe("bedrockCatalog", () => {
  const MODEL_ID_REGEX = /^[a-z0-9][a-z0-9/_:.-]{0,199}$/;

  it("is exactly the 3 account-verified global inference profiles", () => {
    expect(BEDROCK_CATALOG.map((m) => m.id)).toEqual([
      "global.amazon.nova-2-lite-v1:0",
      "global.moonshotai.kimi-k3",
      "global.moonshotai.kimi-k3.1",
    ]);
  });

  it("has unique, well-formed ids passing the backend model-id regex", () => {
    const ids = BEDROCK_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(MODEL_ID_REGEX.test(id), `bad id ${id}`).toBe(true);
    }
  });

  it("is well-formed (name, positive context/maxTokens, sane costs)", () => {
    for (const m of BEDROCK_CATALOG) {
      expect(m.name.trim().length).toBeGreaterThan(0);
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

  it("verified note (both locales, deliberately identical) carries account, region, date", () => {
    expect(en.admin.bedrockVerifiedNote).toContain("229446390715");
    expect(en.admin.bedrockVerifiedNote).toContain("ap-southeast-1");
    expect(en.admin.bedrockVerifiedNote).toContain("2026-11-15");
    expect(vi.admin.bedrockVerifiedNote).toBe(en.admin.bedrockVerifiedNote);
  });
});
