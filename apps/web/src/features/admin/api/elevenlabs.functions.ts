import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRequest, backendBase } from "./admin-gate.server";

/**
 * Server functions for the ElevenLabs key panel on the hidden /admin page. Same gate as every
 * other admin function (HMAC session cookie re-checked here — never trust the client).
 *
 * The key is write-only end to end: it travels only browser → this server function → the
 * loopback backend, is never put in any response, log line or error message, and is never
 * echoed. Status reads expose only `configured` / `updatedAt`.
 */

// Cùng luật với backend: ElevenLabs keys dạng `sk_<hex-ish>`; regex cố tình rộng để không
// phụ thuộc một format cụ thể của nhà cung cấp (10..512, không khoảng trắng/ký tự lạ).
const ELEVENLABS_KEY_REGEX = /^[A-Za-z0-9_\-]{10,512}$/;
const BACKEND_TIMEOUT_MS = 2000;

export type ElevenLabsStatus = { configured: boolean; updatedAt: number | null };

export const getElevenLabsStatusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ElevenLabsStatus> => {
    if (!isAdminRequest()) return { configured: false, updatedAt: null };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/elevenlabs-key`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { configured: false, updatedAt: null };
      const json: unknown = await res.json();
      const configured = (json as { configured?: unknown })?.configured;
      const updatedAt = (json as { updatedAt?: unknown })?.updatedAt;
      return {
        configured: configured === true,
        updatedAt: typeof updatedAt === "number" ? updatedAt : null,
      };
    } catch {
      // Backend chết/timeout ≠ trang chết: báo "not configured", đừng crash.
      return { configured: false, updatedAt: null };
    } finally {
      clearTimeout(timer);
    }
  },
);

export type SetElevenLabsKeyResult =
  | { status: "unauthorized" }
  | { status: "invalid_key" }
  | { status: "backend_error" }
  | { status: "ok"; updatedAt: number | null };

export const setElevenLabsKeyFn = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string().max(512) }))
  .handler(async ({ data }): Promise<SetElevenLabsKeyResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    const key = data.key.trim();
    if (!ELEVENLABS_KEY_REGEX.test(key)) return { status: "invalid_key" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/elevenlabs-key`, {
        method: "PUT",
        signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.status === 400) {
        const json: unknown = await res.json().catch(() => null);
        if ((json as { error?: unknown })?.error === "bad_key") return { status: "invalid_key" };
        return { status: "backend_error" };
      }
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      const updatedAt = (json as { updatedAt?: unknown })?.updatedAt;
      // Không echo key — chỉ thời điểm lưu.
      return { status: "ok", updatedAt: typeof updatedAt === "number" ? updatedAt : null };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  });

export type ClearElevenLabsKeyResult =
  | { status: "unauthorized" }
  | { status: "backend_error" }
  | { status: "ok"; cleared: boolean };

export const clearElevenLabsKeyFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ClearElevenLabsKeyResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/elevenlabs-key`, {
        method: "DELETE",
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      const ok = (json as { ok?: unknown })?.ok;
      const cleared = (json as { cleared?: unknown })?.cleared;
      if (ok !== true || typeof cleared !== "boolean") return { status: "backend_error" };
      return { status: "ok", cleared };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  },
);
