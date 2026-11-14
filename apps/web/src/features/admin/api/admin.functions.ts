import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, getRequestProtocol } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE_S,
  adminConfigured,
  keyMatches,
  makeCookieValue,
  verifyCookieValue,
} from "../model/admin-auth";
import { fetchOpenRouterCatalog, type CatalogModel } from "../runtime/openrouter.server";
import { currentAgentModel } from "../../agent/runtime/agent-model.server";

/**
 * Server functions for the hidden /admin page. Every admin function re-checks the session
 * cookie (HMAC + expiry) — never trust the client. The raw SKY_ADMIN_KEY never leaves the
 * server and never appears in any response, log line or error message.
 */

function adminSecret(): string | undefined {
  const raw = process.env.SKY_ADMIN_KEY;
  const secret = typeof raw === "string" ? raw.trim() : "";
  return secret.length > 0 ? secret : undefined;
}

function isAdminRequest(): boolean {
  const secret = adminSecret();
  if (!secret) return false;
  return verifyCookieValue(secret, getCookie(ADMIN_COOKIE));
}

function backendBase(): string {
  return (process.env.BACKEND_URL?.trim() || "http://127.0.0.1:3200").replace(/\/+$/, "");
}

const MODEL_ID_REGEX = /^[a-z0-9][a-z0-9/_:.-]{0,199}$/;

async function fetchBackendSetting(timeoutMs = 1500): Promise<{ model: string | null; updatedAt: number | null } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${backendBase()}/api/settings/agent-model`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const model = (json as { model?: unknown })?.model;
    const updatedAt = (json as { updatedAt?: unknown })?.updatedAt;
    return {
      model: typeof model === "string" ? model : null,
      updatedAt: typeof updatedAt === "number" ? updatedAt : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const unlockAdminFn = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string().max(512) }))
  .handler(async ({ data }) => {
    const secret = adminSecret();
    if (!secret) return { status: "not_configured" as const };
    if (!keyMatches(secret, data.key)) return { status: "denied" as const };
    const secure = getRequestProtocol() === "https";
    setCookie(ADMIN_COOKIE, makeCookieValue(secret), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_COOKIE_MAX_AGE_S,
      secure,
    });
    return { status: "ok" as const };
  });

export const isAdminFn = createServerFn({ method: "GET" }).handler(async () => {
  const configured = adminConfigured(adminSecret());
  return { configured, admin: configured && isAdminRequest() };
});

export type AdminModelPayload =
  | { status: "unauthorized" }
  | {
      status: "ok";
      /** Effective model: backend setting → env → default. */
      effectiveModel: string;
      /** Raw backend setting (null when unset or backend unreachable). */
      setting: { model: string | null; updatedAt: number | null } | null;
      catalogOk: boolean;
      models: CatalogModel[];
    };

export const adminModelFn = createServerFn({ method: "GET" }).handler(async (): Promise<AdminModelPayload> => {
  if (!isAdminRequest()) return { status: "unauthorized" };
  const effectiveModel = await currentAgentModel();
  const setting = await fetchBackendSetting();
  try {
    const models = await fetchOpenRouterCatalog(5000);
    return { status: "ok", effectiveModel, setting, catalogOk: true, models };
  } catch {
    // Catalog down ≠ page down: still show the effective model, Apply stays disabled client-side.
    return { status: "ok", effectiveModel, setting, catalogOk: false, models: [] };
  }
});

export type SetAgentModelResult =
  | { status: "unauthorized" }
  | { status: "invalid_model" }
  | { status: "catalog_unavailable" }
  | { status: "backend_error" }
  | { status: "ok"; model: string; updatedAt: number | null };

export const setAgentModelFn = createServerFn({ method: "POST" })
  .validator(z.object({ model: z.string().max(512) }))
  .handler(async ({ data }): Promise<SetAgentModelResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    const model = data.model.trim();
    if (!MODEL_ID_REGEX.test(model)) return { status: "invalid_model" };

    let catalog: CatalogModel[];
    try {
      catalog = await fetchOpenRouterCatalog(5000);
    } catch {
      return { status: "catalog_unavailable" };
    }
    if (!catalog.some((m) => m.id === model)) return { status: "invalid_model" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${backendBase()}/api/settings/agent-model`, {
        method: "PUT",
        signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      const updatedAt = (json as { updatedAt?: unknown })?.updatedAt;
      return { status: "ok", model, updatedAt: typeof updatedAt === "number" ? updatedAt : null };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  });
