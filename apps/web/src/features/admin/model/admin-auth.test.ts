import { describe, it, expect } from "vitest";
import {
  adminConfigured,
  keyMatches,
  makeCookieValue,
  verifyCookieValue,
  ADMIN_SESSION_TTL_MS,
} from "./admin-auth";

const SECRET = "test-admin-secret-0123456789";

describe("adminConfigured", () => {
  it("false khi thiếu/rỗng, true khi có key", () => {
    expect(adminConfigured(undefined)).toBe(false);
    expect(adminConfigured("")).toBe(false);
    expect(adminConfigured("   ")).toBe(false);
    expect(adminConfigured("k")).toBe(true);
  });
});

describe("keyMatches", () => {
  it("khớp khi đúng key", () => {
    expect(keyMatches(SECRET, SECRET)).toBe(true);
  });
  it("không khớp khi sai/gần đúng/rỗng", () => {
    expect(keyMatches(SECRET, `${SECRET}x`)).toBe(false);
    expect(keyMatches(SECRET, SECRET.slice(0, -1))).toBe(false);
    expect(keyMatches(SECRET, "")).toBe(false);
    expect(keyMatches(SECRET, SECRET.toUpperCase())).toBe(false);
  });
});

describe("cookie value", () => {
  it("make → verify round-trip", () => {
    const now = 1_800_000_000_000;
    const v = makeCookieValue(SECRET, now);
    expect(v).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(v).not.toContain(SECRET);
    expect(verifyCookieValue(SECRET, v, now)).toBe(true);
  });
  it("hết hạn → reject", () => {
    const now = 1_800_000_000_000;
    const v = makeCookieValue(SECRET, now);
    expect(verifyCookieValue(SECRET, v, now + ADMIN_SESSION_TTL_MS + 1)).toBe(false);
  });
  it("sai secret / giả mạo / rác → reject", () => {
    const now = 1_800_000_000_000;
    const v = makeCookieValue(SECRET, now);
    expect(verifyCookieValue("other-secret", v, now)).toBe(false);
    expect(verifyCookieValue(SECRET, `${v}ff`, now)).toBe(false);
    expect(verifyCookieValue(SECRET, "garbage", now)).toBe(false);
    expect(verifyCookieValue(SECRET, "", now)).toBe(false);
    expect(verifyCookieValue(SECRET, undefined, now)).toBe(false);
    // expiry bị sửa thì chữ ký không còn khớp
    const [expiry, sig] = v.split(".");
    expect(verifyCookieValue(SECRET, `${Number(expiry) + 1000}.${sig}`, now)).toBe(false);
  });
});
