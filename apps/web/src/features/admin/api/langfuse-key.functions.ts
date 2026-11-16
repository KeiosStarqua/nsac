import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRequest } from "./admin-gate.server";
import {
  langfuseKeySource,
  langfuseFileInfo,
  validateLangfuseConfig,
  saveLangfuseConfig,
  clearLangfuseKeyFile,
} from "../../agent/runtime/langfuse-key.server";

/**
 * Server functions for the Langfuse panel on the hidden /admin page. Same gate as every other
 * admin function (HMAC session cookie re-checked here — never trust the client).
 *
 * The triple is write-only end to end: public key, secret key and base URL travel only browser →
 * this server function → the local `var/sky-langfuse.json` file (one atomic record), are never put
 * in any response, log line or error message, and are never echoed. Status reads expose only
 * `source` ("env" | "file" | "none"), `updatedAt`, and — for the stored file only — the base URL,
 * which is an address rather than a credential. The host environment wins as a whole triple.
 */

export type LangfuseStatus =
  | { status: "unauthorized" }
  | { status: "ok"; source: "env" | "file" | "none"; updatedAt: number | null; baseUrl: string | null };

export const getLangfuseStatusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LangfuseStatus> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    const source = langfuseKeySource();
    if (source === "file") {
      const info = langfuseFileInfo();
      return { status: "ok", source, updatedAt: info.updatedAt, baseUrl: info.baseUrl };
    }
    // Env may hold anything (any host, any formatting); show nothing from it.
    return { status: "ok", source, updatedAt: null, baseUrl: null };
  },
);

export type SaveLangfuseKeyResult =
  | { status: "unauthorized" }
  | { status: "invalid_public_key" }
  | { status: "invalid_secret_key" }
  | { status: "invalid_base_url" }
  | { status: "io_error" }
  | { status: "ok" };

export const saveLangfuseKeyFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      publicKey: z.string().max(4096),
      secretKey: z.string().max(4096),
      baseUrl: z.string().max(4096),
    }),
  )
  .handler(async ({ data }): Promise<SaveLangfuseKeyResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    const validated = validateLangfuseConfig(data);
    if (!validated.ok) return { status: validated.error };

    const result = saveLangfuseConfig(validated.value);
    // Validation already passed above, so only an I/O failure can remain.
    if (!result.ok) return { status: "io_error" };
    return { status: "ok" };
  });

export type ClearLangfuseKeyResult = { status: "unauthorized" } | { status: "ok" };

export const clearLangfuseKeyFileFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ClearLangfuseKeyResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    // Env variables cannot be cleared from here — the panel's hint says so.
    clearLangfuseKeyFile();
    return { status: "ok" };
  },
);
