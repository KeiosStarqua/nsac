import "@tanstack/react-start/server-only";
import { getCookie } from "@tanstack/react-start/server";
import {
  ADMIN_COOKIE,
  verifyCookieValue,
} from "../model/admin-auth";

/**
 * Shared admin gate for the hidden /admin page and its backend-proxying server functions.
 * Every admin function re-checks the session cookie (HMAC + expiry) — never trust the client.
 * The raw SKY_ADMIN_KEY never leaves the server and never appears in any response, log line or
 * error message.
 */

export function adminSecret(): string | undefined {
  const raw = process.env.SKY_ADMIN_KEY;
  const secret = typeof raw === "string" ? raw.trim() : "";
  return secret.length > 0 ? secret : undefined;
}

export function isAdminRequest(): boolean {
  const secret = adminSecret();
  if (!secret) return false;
  return verifyCookieValue(secret, getCookie(ADMIN_COOKIE));
}

export function backendBase(): string {
  return (process.env.BACKEND_URL?.trim() || "http://127.0.0.1:3200").replace(/\/+$/, "");
}
