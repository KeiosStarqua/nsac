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
import { fetchOpenRouterCatalog } from "../runtime/openrouter.server";
import { goAsPickerModels, type PickerModel } from "../model/catalog";
import {
  currentAgentModel,
  currentAgentProviderInfo,
  type AgentProvider,
} from "../../agent/runtime/agent-model.server";

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
const PROFILE_KEY_REGEX = /^[a-z0-9-]{1,64}$/;
const MAX_MODEL_ENTRIES = 16;

export type AgentModelsSetting = {
  provider: AgentProvider | null;
  model: string | null;
  models: Record<string, string> | null;
  updatedAt: number | null;
};

/**
 * `GET /api/settings/agent-models` — setting thô trong backend SQLite (provider/legacy model/per-profile map).
 * `null` khi backend lỗi/chưa có route — admin hiển thị trạng thái "chưa cài / không đọc được".
 */
async function fetchBackendSettings(timeoutMs = 1500): Promise<AgentModelsSetting | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${backendBase()}/api/settings/agent-models`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const provider = (json as { provider?: unknown })?.provider;
    const model = (json as { provider?: unknown; model?: unknown })?.model;
    const models = (json as { models?: unknown })?.models;
    const updatedAt = (json as { updatedAt?: unknown })?.updatedAt;
    const cleanModels: Record<string, string> | null =
      models && typeof models === "object" && !Array.isArray(models)
        ? Object.fromEntries(
            Object.entries(models as Record<string, unknown>).filter(
              ([k, v]) => typeof v === "string" && PROFILE_KEY_REGEX.test(k) && MODEL_ID_REGEX.test(v.trim()),
            ) as Array<[string, string]>,
          )
        : null;
    return {
      provider: provider === "opencode-go" || provider === "openrouter" ? provider : null,
      model: typeof model === "string" ? model : null,
      models: cleanModels,
      updatedAt: typeof updatedAt === "number" ? updatedAt : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Catalog cho provider đang chọn. Throws khi OpenRouter catalog lỗi (caller ⇒ catalog_unavailable). */
async function catalogFor(provider: AgentProvider): Promise<PickerModel[]> {
  if (provider === "opencode-go") return goAsPickerModels();
  return fetchOpenRouterCatalog(5000);
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
      /** Effective provider (backend | env | default). */
      provider: AgentProvider;
      providerSource: "backend" | "lastGood" | "env" | "default";
      /** Effective model per profile (server resolution, same source the agent uses). */
      effectiveModels: {
        default: string;
        chat: string;
        orchestrator: string;
        "generative-ui": string;
        "hud-composer": string;
      };
      /** Raw backend setting (null when unset or backend unreachable). */
      setting: AgentModelsSetting | null;
      /**
       * Catalog of the effective provider. `catalogOk` is false only when that catalog is the live
       * OpenRouter fetch and it failed (the Go snapshot is always ok). The live OpenRouter catalog is
       * always fetched once (reused for the dropdowns) and reported separately as `openrouterModels`.
       */
      catalogOk: boolean;
      models: PickerModel[];
      openrouterOk: boolean;
      openrouterModels: PickerModel[];
    };

export const adminModelFn = createServerFn({ method: "GET" }).handler(async (): Promise<AdminModelPayload> => {
  if (!isAdminRequest()) return { status: "unauthorized" };
  const [info, effectiveDefault, chat, orchestrator, generativeUi, hudComposer, setting] = await Promise.all([
    currentAgentProviderInfo(),
    currentAgentModel(),
    currentAgentModel("sky-chat"),
    currentAgentModel("sky-orchestrator"),
    currentAgentModel("sky-generative-ui"),
    currentAgentModel("sky-hud-composer"),
    fetchBackendSettings(),
  ]);
  const effectiveModels = {
    default: effectiveDefault,
    chat,
    orchestrator,
    "generative-ui": generativeUi,
    "hud-composer": hudComposer,
  };
  // OpenRouter live catalog: luôn fetch một lần (reuse cho dropdown; lỗi ≠ page down).
  let openrouterModels: PickerModel[] = [];
  let openrouterOk = true;
  try {
    openrouterModels = await fetchOpenRouterCatalog(5000);
  } catch {
    openrouterOk = false;
  }
  if (info.provider === "opencode-go") {
    const models = goAsPickerModels();
    return {
      status: "ok",
      provider: info.provider,
      providerSource: info.source,
      effectiveModels,
      setting,
      catalogOk: true,
      models,
      openrouterOk,
      openrouterModels,
    };
  }
  return {
    status: "ok",
    provider: info.provider,
    providerSource: info.source,
    effectiveModels,
    setting,
    catalogOk: openrouterOk,
    models: openrouterModels,
    openrouterOk,
    openrouterModels,
  };
});

export type ResetClaimsResult =
  | { status: "unauthorized" }
  | { status: "backend_error" }
  | { status: "ok"; cleared: number };

/**
 * Clears every astronaut claim on the backend demo store (`POST /api/claims/reset`).
 * The backend endpoint itself carries no auth (demo box, loopback-only); the admin session
 * cookie here is the only gate in front of it. The backend body is never echoed back.
 */
export const resetClaimsFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ResetClaimsResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${backendBase()}/api/claims/reset`, {
        method: "POST",
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      const ok = (json as { ok?: unknown })?.ok;
      const cleared = (json as { cleared?: unknown })?.cleared;
      if (ok !== true || typeof cleared !== "number") return { status: "backend_error" };
      return { status: "ok", cleared };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  },
);

export type SetAgentConfigResult =
  | { status: "unauthorized" }
  | { status: "invalid_model" }
  | { status: "catalog_unavailable" }
  | { status: "backend_error" }
  | {
      status: "ok";
      provider: AgentProvider;
      model: string | null;
      models: Record<string, string> | null;
      updatedAt: number | null;
    };

/**
 * Apply the full agent configuration in one shot: provider + legacy global model + per-profile map.
 * `model: null` deletes the legacy `agent.model` key; `models: {}` deletes the `agent.models` key.
 * Every written id must belong to the selected provider's catalog (OpenCode Go: bundled snapshot;
 * OpenRouter: live fetch) — a model id outside the catalog is `invalid_model`.
 */
export const setAgentConfigFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      provider: z.enum(["opencode-go", "openrouter"]),
      model: z.string().max(512).nullable(),
      models: z.record(z.string(), z.string().max(512)),
    }),
  )
  .handler(async ({ data }): Promise<SetAgentConfigResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    const provider = data.provider;
    const model = data.model?.trim() ? data.model!.trim() : null;
    if (model !== null && !MODEL_ID_REGEX.test(model)) return { status: "invalid_model" };

    if (Object.keys(data.models).length > MAX_MODEL_ENTRIES) return { status: "invalid_model" };
    const models: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.models)) {
      if (!PROFILE_KEY_REGEX.test(key)) return { status: "invalid_model" };
      const v = value.trim();
      if (v === "") continue; // client đã lọc; bỏ entry rỗng một cách im lặng
      if (!MODEL_ID_REGEX.test(v)) return { status: "invalid_model" };
      models[key] = v;
    }

    // Catalog check cho provider đích (một catalog — không trộn lẫn fallback giữa 2 provider).
    let catalog: PickerModel[];
    try {
      catalog = await catalogFor(provider);
    } catch {
      return { status: "catalog_unavailable" };
    }
    const catalogIds = new Set(catalog.map((m) => m.id));
    if (model !== null && !catalogIds.has(model)) return { status: "invalid_model" };
    for (const v of Object.values(models)) {
      if (!catalogIds.has(v)) return { status: "invalid_model" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${backendBase()}/api/settings/agent-models`, {
        method: "PUT",
        signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ provider, model, models }),
      });
      if (!res.ok) return { status: "backend_error" };
      const json: unknown = await res.json();
      const updatedAt = (json as { updatedAt?: unknown })?.updatedAt;
      return {
        status: "ok",
        provider,
        model,
        models: Object.keys(models).length > 0 ? models : null,
        updatedAt: typeof updatedAt === "number" ? updatedAt : null,
      };
    } catch {
      return { status: "backend_error" };
    } finally {
      clearTimeout(timer);
    }
  });
