// Unit tests for the pure /admin/schedules draft validation — no IO, no Mastra.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROMPTS,
  defaultPromptFor,
  isCronLike,
  isIanaTimeZone,
  validateScheduleDraft,
} from "./schedules-validate";

describe("isCronLike", () => {
  it("accepts 5/6/7-part expressions and croner nicknames", () => {
    expect(isCronLike("0 7 * * *")).toBe(true);
    expect(isCronLike("0 9,17 * * *")).toBe(true);
    expect(isCronLike("*/15 * * * *")).toBe(true);
    expect(isCronLike("0 0 7 * * ?")).toBe(true);
    expect(isCronLike("0 0 7 * * ? *")).toBe(true);
    expect(isCronLike("@daily")).toBe(true);
    expect(isCronLike("@hourly")).toBe(true);
    expect(isCronLike("@weekly")).toBe(true);
    expect(isCronLike("@monthly")).toBe(true);
    expect(isCronLike("@midnight")).toBe(true);
    expect(isCronLike("  0 7 * * *  ")).toBe(true);
  });

  it("rejects empty, garbage and wrong part counts", () => {
    expect(isCronLike("")).toBe(false);
    expect(isCronLike("   ")).toBe(false);
    expect(isCronLike("bad cron")).toBe(false);
    expect(isCronLike("0 7 *")).toBe(false);
    expect(isCronLike("* * * *")).toBe(false);
    expect(isCronLike("0 0 0 0 0 0 0 0")).toBe(false);
    expect(isCronLike("0 7 * * !")).toBe(false);
    expect(isCronLike("0 7 * * * %")).toBe(false);
    expect(isCronLike("@yearly")).toBe(false);
    expect(isCronLike("0;rm -rf * * * *")).toBe(false);
  });
});

describe("isIanaTimeZone", () => {
  it("accepts real zones and rejects garbage", () => {
    expect(isIanaTimeZone("Asia/Ho_Chi_Minh")).toBe(true);
    expect(isIanaTimeZone("UTC")).toBe(true);
    expect(isIanaTimeZone("Europe/Berlin")).toBe(true);
    expect(isIanaTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isIanaTimeZone("")).toBe(false);
    expect(isIanaTimeZone("Asia/Ho_Chi_Minh; DROP TABLE")).toBe(false);
  });
});

describe("validateScheduleDraft", () => {
  const valid = { astronautId: "ayla-reyes", kind: "checkin", cron: "0 7 * * *" };

  it("accepts a minimal valid draft and defaults the timezone", () => {
    const r = validateScheduleDraft(valid);
    expect(r).toEqual({ ok: true, value: { ...valid, timezone: "Asia/Ho_Chi_Minh", prompt: null, name: null } });
  });

  it("rejects unknown astronauts and kinds", () => {
    expect(validateScheduleDraft({ ...valid, astronautId: "john-doe" })).toEqual({ ok: false, error: "unknown_astronaut" });
    expect(validateScheduleDraft({ ...valid, kind: "medical-officer" })).toEqual({ ok: false, error: "bad_kind" });
    expect(validateScheduleDraft({ ...valid, kind: "" })).toEqual({ ok: false, error: "bad_kind" });
  });

  it("rejects bad cron/timezone/prompt/name", () => {
    expect(validateScheduleDraft({ ...valid, cron: "whenever" })).toEqual({ ok: false, error: "bad_cron" });
    expect(validateScheduleDraft({ ...valid, timezone: "Mars/Olympus_Mons" })).toEqual({ ok: false, error: "bad_timezone" });
    expect(validateScheduleDraft({ ...valid, prompt: "x".repeat(1001) })).toEqual({ ok: false, error: "bad_prompt" });
    expect(validateScheduleDraft({ ...valid, name: "n".repeat(121) })).toEqual({ ok: false, error: "bad_name" });
  });

  it("keeps a provided timezone and trimmed prompt/name", () => {
    const r = validateScheduleDraft({
      ...valid,
      timezone: "UTC",
      prompt: "  hello  ",
      name: "  Morning  ",
    });
    expect(r).toEqual({ ok: true, value: { ...valid, timezone: "UTC", prompt: "hello", name: "Morning" } });
  });

  it("has a default prompt for every kind", () => {
    for (const kind of Object.keys(DEFAULT_PROMPTS) as Array<keyof typeof DEFAULT_PROMPTS>) {
      expect(defaultPromptFor(kind).length).toBeGreaterThan(0);
    }
  });
});
