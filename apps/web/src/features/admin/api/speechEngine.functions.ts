import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRequest, backendBase } from "./admin-gate.server";

/**
 * Server functions for the Speech Engine panel on the hidden /admin page. Same gate as every
 * other admin function (HMAC session cookie re-checked here — never trust the client).
 *
 * The ElevenLabs API key is never in scope for this module: the backend reads it server-side.
 * Engine ids are public instance handles and safe to return; `lastError` carries no key material.
 * Response shapes are validated with loose zod schemas — the backend stays the source of truth
 * and additive fields keep working. If the backend is down, functions resolve to
 * `{ status: "backend_error" }` so the panel can show a friendly message instead of crashing.
 */

const BACKEND_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Loose zod schemas of the backend envelopes (additive-compatible).
// ---------------------------------------------------------------------------

const statusSchema = z.object({
  ok: z.literal(true),
  configured: z.boolean(),
  engineId: z.string().nullable(),
  source: z.enum(["env", "db"]).nullable(),
  wsRunning: z.boolean(),
  port: z.number(),
  lastError: z.string().nullable(),
  apiKeyConfigured: z.boolean(),
  envOverridesDb: z.boolean(),
});
export type SpeechEngineStatus = z.infer<typeof statusSchema>;

const probeSchema = z.object({
  ok: z.boolean(),
  httpStatus: z.number().optional(),
  message: z.string().optional(),
});
export type ProbeResult = z.infer<typeof probeSchema>;

const createSchema = z.object({
  ok: z.boolean(),
  engineId: z.string().optional(),
  wsUrl: z.string().optional(),
  wsRunning: z.boolean().optional(),
  envShadowing: z.boolean().optional(),
  httpStatus: z.number().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});
export type CreateResult = z.infer<typeof createSchema>;

const wsSchema = z.object({
  ok: z.literal(true),
  wsRunning: z.boolean(),
});
export type WsToggleResult = z.infer<typeof wsSchema>;

const deleteSchema = z.object({
  ok: z.boolean(),
  deleted: z.string().optional(),
  note: z.string().optional(),
  httpStatus: z.number().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});
export type DeleteResult = z.infer<typeof deleteSchema>;

export type AdminProxy<T> =
  | { status: "ok"; data: T }
  | { status: "unauthorized" }
  | { status: "backend_error" };

const createInputSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  wsUrl: z.string().trim().min(1).max(2048).optional(),
});
export type CreateInput = z.infer<typeof createInputSchema>;

const deleteInputSchema = z.object({
  id: z.string().trim().min(1).max(256).optional(),
});
export type DeleteInput = z.infer<typeof deleteInputSchema>;

// ---------------------------------------------------------------------------
// Shared loopback proxy helper.
// ---------------------------------------------------------------------------

async function proxyToBackend<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<AdminProxy<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${backendBase()}${path}`, {
      signal: controller.signal,
      headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}) },
      ...init,
    });
    const json: unknown = await res.json().catch(() => undefined);
    const parsed = schema.safeParse(json);
    if (!parsed.success) return { status: "backend_error" };
    return { status: "ok", data: parsed.data };
  } catch {
    return { status: "backend_error" };
  } finally {
    clearTimeout(timer);
  }
}

export const getSpeechEngineStatusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminProxy<SpeechEngineStatus>> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    return proxyToBackend("/api/settings/speech-engine", statusSchema);
  },
);

export const probeSpeechEngineFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<AdminProxy<ProbeResult>> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    return proxyToBackend("/api/settings/speech-engine/probe", probeSchema, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
);

export const createSpeechEngineFn = createServerFn({ method: "POST" })
  .validator(createInputSchema)
  .handler(async ({ data }): Promise<AdminProxy<CreateResult>> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    return proxyToBackend("/api/settings/speech-engine/create", createSchema, {
      method: "POST",
      body: JSON.stringify(data),
    });
  });

export const stopSpeechEngineFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<AdminProxy<WsToggleResult>> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    return proxyToBackend("/api/settings/speech-engine/stop", wsSchema, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
);

export const startSpeechEngineFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<AdminProxy<WsToggleResult>> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    return proxyToBackend("/api/settings/speech-engine/start", wsSchema, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
);

export const deleteSpeechEngineFn = createServerFn({ method: "POST" })
  .validator(deleteInputSchema)
  .handler(async ({ data }): Promise<AdminProxy<DeleteResult>> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    return proxyToBackend("/api/settings/speech-engine/delete", deleteSchema, {
      method: "POST",
      body: JSON.stringify(data),
    });
  });
