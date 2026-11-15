import "@tanstack/react-start/server-only";

/**
 * Nguồn hiệu lực của Sky agent, theo thứ tự:
 *
 * Provider (`currentAgentProvider()`):
 *   1. Backend SQLite `app_settings.agent.provider` (`GET /api/settings/agent-models`)
 *   2. `lastGood` provider gần nhất (backend lỗi/không reachable)
 *   3. `SKY_AGENT_PROVIDER` (case/trim, giá trị lạ bỏ qua)
 *   4. `"opencode-go"` (mặc định; OpenRouter là nhánh legacy)
 *
 * Model (`currentAgentModel(profile?)`):
 *   1. Backend `agent.models[profile]` — chỉ khi `profile` truyền vào và có trong map
 *      (validate regex lần nữa; rác ⇒ bỏ qua)
 *   2. Backend legacy `agent.model`
 *   3. `SKY_AGENT_MODEL` (global, cả 3 provider) → provider-specific
 *      `SKY_OPENCODE_MODEL` (go) / `SKY_OPENROUTER_MODEL` (openrouter) / `SKY_BEDROCK_MODEL` (amazon-bedrock)
 *   4. Provider default: opencode-go → `deepseek-v4.1-flash`; openrouter → `thinkingmachines/inkling-2-small:free`;
 *      amazon-bedrock → `global.amazon.nova-2-lite-v1:0`
 *
 * `currentAgentProviderInfo()` thêm `source` cho /health (backend | env | default).
 */
export type AgentProvider = "opencode-go" | "openrouter" | "amazon-bedrock";

const DEFAULT_GO_MODEL = "deepseek-v4.1-flash";
const DEFAULT_OPENROUTER_MODEL = "thinkingmachines/inkling-2-small:free";
const DEFAULT_BEDROCK_MODEL = "global.amazon.nova-2-lite-v1:0";

const BACKEND_TIMEOUT_MS = 1200; // Trong khoảng 1000–1500ms theo spec
const CACHE_TTL_MS = 2000; // Cache tạm cho burst (composer + orchestrator + chat cùng turn)
const FAIL_CACHE_TTL_MS = 500; // Lỗi không được cache lâu — lượt sau thử lại sớm

const MODEL_ID_REGEX = /^[a-z0-9][a-z0-9/_:.-]{0,199}$/;
const PROFILE_KEY_REGEX = /^[a-z0-9-]{1,64}$/;

function isValidModelId(value: unknown): value is string {
  return typeof value === "string" && MODEL_ID_REGEX.test(value.trim());
}

function backendBase(): string {
  return (process.env.BACKEND_URL?.trim() || "http://127.0.0.1:3200").replace(/\/+$/, "");
}

function envProvider(): AgentProvider | null {
  const raw = process.env.SKY_AGENT_PROVIDER?.trim().toLowerCase();
  if (raw === "opencode-go" || raw === "openrouter" || raw === "amazon-bedrock") return raw;
  return null; // Giá trị lạ ⇒ bỏ qua, rơi về default
}

function envModel(provider: AgentProvider): string | undefined {
  return (
    process.env.SKY_AGENT_MODEL?.trim() ||
    (provider === "opencode-go"
      ? process.env.SKY_OPENCODE_MODEL?.trim()
      : provider === "openrouter"
        ? process.env.SKY_OPENROUTER_MODEL?.trim()
        : process.env.SKY_BEDROCK_MODEL?.trim()) ||
    undefined
  );
}

function providerDefault(provider: AgentProvider): string {
  if (provider === "opencode-go") return DEFAULT_GO_MODEL;
  if (provider === "openrouter") return DEFAULT_OPENROUTER_MODEL;
  return DEFAULT_BEDROCK_MODEL;
}

type BackendSettings =
  | { ok: true; provider: AgentProvider | null; models: Record<string, string> | null; model: string | null }
  | { ok: false };

function parseLegacyModel(json: unknown): string | null {
  const raw = (json as { model?: unknown } | null)?.model;
  if (raw === null || raw === undefined) return null;
  if (!isValidModelId(raw)) return null; // Giá trị rác từ DB coi như chưa cài
  return (raw as string).trim();
}

function parseBackendSettings(json: unknown): {
  provider: AgentProvider | null;
  models: Record<string, string> | null;
  model: string | null;
} {
  const rawProvider = (json as { provider?: unknown } | null)?.provider;
  const provider =
    rawProvider === "opencode-go" || rawProvider === "openrouter" || rawProvider === "amazon-bedrock"
      ? rawProvider
      : null;
  const model = parseLegacyModel(json);
  const rawModels = (json as { models?: unknown } | null)?.models;
  if (!rawModels || typeof rawModels !== "object" || Array.isArray(rawModels)) {
    return { provider, models: null, model };
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawModels)) {
    // Rác trong map ⇒ bỏ qua toàn bộ map (coi như chưa cài), không tin vào entry nào.
    if (!PROFILE_KEY_REGEX.test(key)) return { provider, models: null, model };
    if (!isValidModelId(value)) return { provider, models: null, model };
    out[key] = (value as string).trim();
  }
  return { provider, models: out, model };
}

async function fetchJson(path: string): Promise<{ ok: boolean; json?: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${backendBase()}${path}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { ok: false };
    return { ok: true, json: (await res.json()) as unknown };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBackendSettings(): Promise<BackendSettings> {
  const primary = await fetchJson("/api/settings/agent-models");
  if (primary.ok) {
    return { ok: true, ...parseBackendSettings(primary.json) };
  }
  // Backend cũ (chưa có /api/settings/agent-models): rơi về route legacy cho model global.
  // Provider/models được coi là chưa cài — box deploy cùng lượt nhưng không được crash-loop logic.
  const legacy = await fetchJson("/api/settings/agent-model");
  if (!legacy.ok) return { ok: false };
  return { ok: true, provider: null, models: null, model: parseLegacyModel(legacy.json) };
}

// Cache fetch backend một lần cho burst (provider + model + nhiều profile cùng turn).
let backendCached: { settings: BackendSettings; at: number; ttl: number } | null = null;

async function backendSettings(): Promise<BackendSettings> {
  const now = Date.now();
  if (backendCached && now - backendCached.at < backendCached.ttl) return backendCached.settings;
  const settings = await fetchBackendSettings();
  backendCached = { settings, at: now, ttl: settings.ok ? CACHE_TTL_MS : FAIL_CACHE_TTL_MS };
  return settings;
}

/** Provider đã trả về từ backend lần gần nhất; dùng khi backend lỗi tạm thời. */
let lastGoodProvider: AgentProvider | null = null;
const modelCache = new Map<string, { model: string; at: number; ttl: number }>();
/** Model đã trả về từ backend lần gần nhất, theo từng profile và global (key ""). */
const lastGood = new Map<string, string>();

const cacheKeyFor = (profile?: string) => profile?.trim() || "";

type ProviderSource = "backend" | "lastGood" | "env" | "default";

async function resolveProvider(): Promise<{ provider: AgentProvider; source: ProviderSource }> {
  const s = await backendSettings();
  if (s.ok) {
    if (s.provider) {
      lastGoodProvider = s.provider;
      return { provider: s.provider, source: "backend" };
    }
    const env = envProvider();
    return env ? { provider: env, source: "env" } : { provider: "opencode-go", source: "default" };
  }
  if (lastGoodProvider) return { provider: lastGoodProvider, source: "lastGood" };
  const env = envProvider();
  return env ? { provider: env, source: "env" } : { provider: "opencode-go", source: "default" };
}

export async function currentAgentProvider(): Promise<AgentProvider> {
  return (await resolveProvider()).provider;
}

/** Như currentAgentProvider nhưng kèm nguồn — /health dùng để hiển thị "backend | env | default". */
export async function currentAgentProviderInfo(): Promise<{
  provider: AgentProvider;
  source: ProviderSource;
}> {
  return resolveProvider();
}

export async function currentAgentModel(profile?: string): Promise<string> {
  const key = cacheKeyFor(profile);
  const now = Date.now();
  const hit = modelCache.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.model;

  const s = await backendSettings();
  const { provider } = await resolveProvider();
  const env = envModel(provider);
  let model: string;
  let ttl = CACHE_TTL_MS;

  if (s.ok) {
    const fromProfile = key !== "" ? s.models?.[key] : undefined; // đã validate ở parseBackendSettings
    const fromLegacy = s.model ?? undefined;
    model = fromProfile ?? fromLegacy ?? env ?? providerDefault(provider);
    if (fromProfile !== undefined) lastGood.set(key, fromProfile);
    else if (fromLegacy !== undefined) lastGood.set("", fromLegacy);
  } else {
    // Backend lỗi/unreachable → last known good (profile rồi global) → env → default; cache ngắn.
    model =
      (key !== "" ? lastGood.get(key) : undefined) ?? lastGood.get("") ?? env ?? providerDefault(provider);
    ttl = FAIL_CACHE_TTL_MS;
  }

  modelCache.set(key, { model, at: now, ttl });
  return model;
}

/** Pure helper: true khi model đổi giữa hai lần đọc (bỏ qua khoảng trắng thừa). */
export function modelChanged(previous: string | null | undefined, current: string | null | undefined): boolean {
  return (previous ?? "").trim() !== (current ?? "").trim();
}

/** Chỉ dùng cho test: reset cache trong process. */
export function resetAgentModelCacheForTests(): void {
  backendCached = null;
  lastGoodProvider = null;
  modelCache.clear();
  lastGood.clear();
}
