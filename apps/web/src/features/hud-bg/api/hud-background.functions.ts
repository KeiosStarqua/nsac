import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRequest, backendBase } from "../../admin/api/admin-gate.server";

/**
 * Server functions for the `/` backdrop (admin-configured on `/admin/background`).
 *
 * Two surfaces:
 * - `getHudBackgroundPublicFn` — read-only, NOT admin-gated: the console needs the value for every
 *   visitor. It reads the loopback backend and resolves `particles` on any failure, so a down or
 *   slow backend can never break the page.
 * - `getHudBackgroundFn` / `setHudBackgroundFn` — admin-gated (same HMAC cookie re-check as every
 *   other admin function) for the BackgroundTab.
 */

const BACKEND_TIMEOUT_MS = 1500;

export const HUD_BACKGROUNDS = ["particles", "galaxy"] as const;
export type HudBackground = (typeof HUD_BACKGROUNDS)[number];

// Literal enum so the schema type is exactly `HudBackground` (a readonly tuple is not a mutable
// `[T, ...T[]]` for zod's signature); a drift between the two fails the `HudBackground` check.
export const hudBackgroundSchema = z.object({
  background: z.enum(["particles", "galaxy"]),
});

/** Chỉ `galaxy` khác default; mọi giá trị lạ/rác đều quy về `particles`. */
function normalizeBackground(value: unknown): HudBackground {
  return value === "galaxy" ? "galaxy" : "particles";
}

function normalizeUpdatedAt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Public read for the console. Never throws; any failure (backend down, timeout, garbage payload)
 * means the default — `particles`.
 */
export const getHudBackgroundPublicFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ background: HudBackground }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/hud-background`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { background: "particles" };
      const json: unknown = await res.json();
      return { background: normalizeBackground((json as { background?: unknown })?.background) };
    } catch {
      return { background: "particles" };
    } finally {
      clearTimeout(timer);
    }
  },
);

export type HudBackgroundStateResult =
  | { status: "ok"; background: HudBackground; updatedAt: number | null }
  | { status: "unauthorized" }
  | { status: "backend_error" };

/** Admin read for the BackgroundTab: current value + when it was last saved. */
export const getHudBackgroundFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<HudBackgroundStateResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/hud-background`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      return {
        status: "ok",
        background: normalizeBackground((json as { background?: unknown })?.background),
        updatedAt: normalizeUpdatedAt((json as { updatedAt?: unknown })?.updatedAt),
      };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  },
);

export type SetHudBackgroundResult =
  | { status: "ok"; background: HudBackground; updatedAt: number | null }
  | { status: "unauthorized" }
  | { status: "invalid_background" }
  | { status: "backend_error" };

/** Admin write: PUT the chosen backdrop. Backend 400 ⇒ `invalid_background`. */
export const setHudBackgroundFn = createServerFn({ method: "POST" })
  .validator(hudBackgroundSchema)
  .handler(async ({ data }): Promise<SetHudBackgroundResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/hud-background`, {
        method: "PUT",
        signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ background: data.background }),
      });
      if (res.status === 400) {
        const json: unknown = await res.json().catch(() => null);
        if ((json as { error?: unknown })?.error === "bad_background") return { status: "invalid_background" };
        return { status: "backend_error" };
      }
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      return {
        status: "ok",
        background: normalizeBackground((json as { background?: unknown })?.background),
        updatedAt: normalizeUpdatedAt((json as { updatedAt?: unknown })?.updatedAt),
      };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  });
