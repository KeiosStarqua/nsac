import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Auth cho trang ẩn /admin. Tất cả pure, không IO — vitest cover được.
 *
 * Cookie `sky_admin` = `<expiryUnixMs>.<hmac-sha256-hex(secret, expiry)>` — KHÔNG chứa key gốc.
 * Unlock so sánh digest SHA-256 của key do user nhập với digest kỳ vọng (tính từ SKY_ADMIN_KEY)
 * bằng timingSafeEqual, không so chuỗi plaintext.
 */
export const ADMIN_COOKIE = "sky_admin";
export const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000; // 1800s, khớp Max-Age cookie
export const ADMIN_COOKIE_MAX_AGE_S = 1800;

export function adminConfigured(secret: string | undefined): boolean {
  return typeof secret === "string" && secret.trim().length > 0;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** So sánh key user nhập với SKY_ADMIN_KEY qua digest — không lộ timing trên plaintext. */
export function keyMatches(secret: string, provided: string): boolean {
  if (typeof provided !== "string" || provided.length === 0 || provided.length > 512) return false;
  const expected = createHash("sha256").update(`${secret}\u0000${secret}`).digest();
  const candidate = createHash("sha256").update(`${secret}\u0000${provided}`).digest();
  return safeEqual(candidate, expected);
}

function signExpiry(secret: string, expiryMs: number): string {
  return createHmac("sha256", secret).update(String(expiryMs)).digest("hex");
}

/** Tạo giá trị cookie sau khi unlock thành công. */
export function makeCookieValue(secret: string, now: number = Date.now()): string {
  const expiry = now + ADMIN_SESSION_TTL_MS;
  return `${expiry}.${signExpiry(secret, expiry)}`;
}

/** Parse + verify cookie: đúng format, chữ ký HMAC khớp, chưa hết hạn. */
export function verifyCookieValue(
  secret: string,
  value: string | undefined | null,
  now: number = Date.now(),
): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) return false;
  const expiryRaw = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!/^\d{10,20}$/.test(expiryRaw)) return false;
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || expiry <= now) return false;
  const expected = signExpiry(secret, expiry);
  return safeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
}
