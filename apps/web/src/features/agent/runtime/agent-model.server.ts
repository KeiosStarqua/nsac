import "@tanstack/react-start/server-only";

/**
 * Nguồn model hiệu lực của Sky agent, theo thứ tự:
 *   1. Cài đặt `agent.model` trong backend SQLite (`GET /api/settings/agent-model`)
 *   2. Giá trị backend đã trả về lần gần nhất (khi backend lỗi/không reachable) — `lastGood`
 *   3. `SKY_OPENROUTER_MODEL`
 *   4. Mặc định hardcoded — phải khớp `defaultModel` trong các agent profile
 *      (`agents/orchestrator.ts`, `agents/chat.ts`, `agents/generative-ui.ts`).
 */
// Hardcoded default khớp profile.defaultModel — đừng đổi một chỗ mà quên chỗ kia.
const DEFAULT_MODEL = "thinkingmachines/inkling-2-small:free";

const BACKEND_TIMEOUT_MS = 1200; // Trong khoảng 1000–1500ms theo spec
const CACHE_TTL_MS = 2000; // Cache tạm cho burst (composer + orchestrator + chat cùng turn)
const FAIL_CACHE_TTL_MS = 500; // Lỗi không được cache lâu — lượt sau thử lại sớm

const MODEL_ID_REGEX = /^[a-z0-9][a-z0-9/_:.-]{0,199}$/;

function isValidModelId(value: unknown): value is string {
  return typeof value === "string" && MODEL_ID_REGEX.test(value.trim());
}

function backendBase(): string {
  return (process.env.BACKEND_URL?.trim() || "http://127.0.0.1:3200").replace(/\/+$/, "");
}

type BackendResult =
  | { ok: true; model: string | null }
  | { ok: false };

async function fetchBackendModel(): Promise<BackendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${backendBase()}/api/settings/agent-model`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { ok: false };
    const json: unknown = await res.json();
    const raw = (json as { model?: unknown } | null)?.model;
    if (raw === null || raw === undefined) return { ok: true, model: null };
    if (!isValidModelId(raw)) return { ok: true, model: null }; // Giá trị rác từ DB coi như chưa cài
    return { ok: true, model: raw.trim() };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

let cached: { model: string; at: number; ttl: number } | null = null;
/** Model backend đã trả về lần gần nhất; dùng khi backend lỗi tạm thời. */
let lastGood: string | null = null;

export async function currentAgentModel(): Promise<string> {
  const now = Date.now();
  if (cached && now - cached.at < cached.ttl) return cached.model;

  const result = await fetchBackendModel();
  let model: string;
  let ttl = CACHE_TTL_MS;

  if (result.ok && result.model) {
    model = result.model;
    lastGood = model;
  } else if (result.ok) {
    // Backend reachable nhưng chưa cài setting → env → default.
    model = process.env.SKY_OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  } else {
    // Backend lỗi/unreachable → last known good → env → default; cache ngắn.
    model = lastGood ?? process.env.SKY_OPENROUTER_MODEL?.trim() ?? DEFAULT_MODEL;
    ttl = FAIL_CACHE_TTL_MS;
  }

  cached = { model, at: now, ttl };
  return model;
}

/** Pure helper: true khi model đổi giữa hai lần đọc (bỏ qua khoảng trắng thừa). */
export function modelChanged(previous: string | null | undefined, current: string | null | undefined): boolean {
  return (previous ?? "").trim() !== (current ?? "").trim();
}

/** Chỉ dùng cho test: reset cache trong process. */
export function resetAgentModelCacheForTests(): void {
  cached = null;
  lastGood = null;
}
