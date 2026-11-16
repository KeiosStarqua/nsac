import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRequest, backendBase } from "../../admin/api/admin-gate.server";

/**
 * Server functions for the `/` console variant (admin-configured on `/admin/ui`).
 *
 * Two surfaces:
 * - `getHudUiPublicFn` — read-only, NOT admin-gated: the console needs the value for every
 *   visitor. It reads the loopback backend and resolves `mock` on any failure, so a down or
 *   slow backend can never break the page.
 * - `getHudUiFn` / `setHudUiFn` — admin-gated (same HMAC cookie re-check as every other admin
 *   function) for the UiTab.
 */

const BACKEND_TIMEOUT_MS = 1500;

export const HUD_UIS = ["mock", "gen"] as const;
export type HudUi = (typeof HUD_UIS)[number];

// Literal enum so the schema type is exactly `HudUi` (a readonly tuple is not a mutable
// `[T, ...T[]]` for zod's signature); a drift between the two fails the `HudUi` check.
export const hudUiSchema = z.object({
  ui: z.enum(["mock", "gen"]),
});

/** Chỉ `gen` khác default; mọi giá trị lạ/rác đều quy về `mock`. */
function normalizeUi(value: unknown): HudUi {
  return value === "gen" ? "gen" : "mock";
}

function normalizeUpdatedAt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Public read for the console. Never throws; any failure (backend down, timeout, garbage payload)
 * means the default — `mock`.
 */
export const getHudUiPublicFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ui: HudUi }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/hud-ui`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { ui: "mock" };
      const json: unknown = await res.json();
      return { ui: normalizeUi((json as { ui?: unknown })?.ui) };
    } catch {
      return { ui: "mock" };
    } finally {
      clearTimeout(timer);
    }
  },
);

export type HudUiStateResult =
  | { status: "ok"; ui: HudUi; updatedAt: number | null }
  | { status: "unauthorized" }
  | { status: "backend_error" };

/** Admin read for the UiTab: current value + when it was last saved. */
export const getHudUiFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<HudUiStateResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/hud-ui`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      return {
        status: "ok",
        ui: normalizeUi((json as { ui?: unknown })?.ui),
        updatedAt: normalizeUpdatedAt((json as { updatedAt?: unknown })?.updatedAt),
      };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  },
);

export type SetHudUiResult =
  | { status: "ok"; ui: HudUi; updatedAt: number | null }
  | { status: "unauthorized" }
  | { status: "invalid_ui" }
  | { status: "backend_error" };

/** Admin write: PUT the chosen console variant. Backend 400 ⇒ `invalid_ui`. */
export const setHudUiFn = createServerFn({ method: "POST" })
  .validator(hudUiSchema)
  .handler(async ({ data }): Promise<SetHudUiResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendBase()}/api/settings/hud-ui`, {
        method: "PUT",
        signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ui: data.ui }),
      });
      if (res.status === 400) {
        const json: unknown = await res.json().catch(() => null);
        if ((json as { error?: unknown })?.error === "bad_hud_ui") return { status: "invalid_ui" };
        return { status: "backend_error" };
      }
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      return {
        status: "ok",
        ui: normalizeUi((json as { ui?: unknown })?.ui),
        updatedAt: normalizeUpdatedAt((json as { updatedAt?: unknown })?.updatedAt),
      };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  });
