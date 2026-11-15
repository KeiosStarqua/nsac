import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRequest } from "./admin-gate.server";
import {
  openCodeKeySource,
  openCodeKeyFileInfo,
  saveOpenCodeKey,
  clearOpenCodeKeyFile,
} from "../../agent/runtime/opencode-key.server";

/**
 * Server functions for the OpenCode Go key panel on the hidden /admin page. Same gate as every
 * other admin function (HMAC session cookie re-checked here — never trust the client).
 *
 * The key is write-only end to end: it travels only browser → this server function → the local
 * `var/sky-opencode.json` file, is never put in any response, log line or error message, and is
 * never echoed. Status reads expose only `source` ("env" | "file" | "none") and `updatedAt`.
 */

// Mirrors the store: printable ASCII, no space, 8..512 chars.
const OPENCODE_KEY_REGEX = /^[!-~]{8,512}$/;

export type OpenCodeKeyInfo =
  | { status: "unauthorized" }
  | { status: "ok"; source: "env" | "file" | "none"; updatedAt: number | null };

export const getOpenCodeKeyInfoFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<OpenCodeKeyInfo> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    const source = openCodeKeySource();
    const updatedAt = source === "file" ? openCodeKeyFileInfo().updatedAt : null;
    return { status: "ok", source, updatedAt };
  },
);

export type SaveOpenCodeKeyResult =
  | { status: "unauthorized" }
  | { status: "invalid_key" }
  | { status: "io_error" }
  | { status: "ok" };

export const saveOpenCodeKeyFn = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string().max(512) }))
  .handler(async ({ data }): Promise<SaveOpenCodeKeyResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    const trimmed = data.key.trim();
    if (!OPENCODE_KEY_REGEX.test(trimmed)) return { status: "invalid_key" };

    const result = saveOpenCodeKey(trimmed);
    if (!result.ok) return { status: result.error };
    return { status: "ok" };
  });

export type ClearOpenCodeKeyResult = { status: "unauthorized" } | { status: "ok" };

export const clearOpenCodeKeyFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ClearOpenCodeKeyResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    // Env vars cannot be cleared from here — the panel's hint says so.
    clearOpenCodeKeyFile();
    return { status: "ok" };
  },
);
