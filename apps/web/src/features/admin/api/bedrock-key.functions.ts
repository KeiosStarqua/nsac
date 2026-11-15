import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRequest } from "./admin-gate.server";
import {
  bedrockKeySource,
  bedrockKeyFileInfo,
  saveBedrockKey,
  clearBedrockKeyFile,
} from "../../agent/runtime/bedrock-key.server";

/**
 * Server functions for the AWS Bedrock panel on the hidden /admin page. Same gate as every other
 * admin function (HMAC session cookie re-checked here — never trust the client).
 *
 * The bearer token is write-only end to end: it travels only browser → this server function → the
 * local `var/sky-bedrock.json` file, is never put in any response, log line or error message, and
 * is never echoed. Status reads expose only `source` ("env" | "file" | "none") and `updatedAt`.
 * `AWS_BEARER_TOKEN_BEDROCK` on the host always wins; the stored file is the fallback.
 */

// Mirrors the store: printable ASCII, no space, 8..4096 chars.
const BEDROCK_KEY_REGEX = /^[!-~]{8,4096}$/;

export type BedrockKeyInfo =
  | { status: "unauthorized" }
  | { status: "ok"; source: "env" | "file" | "none"; updatedAt: number | null };

export const getBedrockKeyInfoFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<BedrockKeyInfo> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    const source = bedrockKeySource();
    const updatedAt = source === "file" ? bedrockKeyFileInfo().updatedAt : null;
    return { status: "ok", source, updatedAt };
  },
);

export type SaveBedrockKeyResult =
  | { status: "unauthorized" }
  | { status: "invalid_key" }
  | { status: "io_error" }
  | { status: "ok" };

export const saveBedrockKeyFn = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string().max(4096) }))
  .handler(async ({ data }): Promise<SaveBedrockKeyResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    const trimmed = data.key.trim();
    if (!BEDROCK_KEY_REGEX.test(trimmed)) return { status: "invalid_key" };

    const result = saveBedrockKey(trimmed);
    if (!result.ok) return { status: result.error };
    return { status: "ok" };
  });

export type ClearBedrockKeyResult = { status: "unauthorized" } | { status: "ok" };

export const clearBedrockKeyFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ClearBedrockKeyResult> => {
    if (!isAdminRequest()) return { status: "unauthorized" };
    // Env vars cannot be cleared from here — the panel's hint says so.
    clearBedrockKeyFile();
    return { status: "ok" };
  },
);
