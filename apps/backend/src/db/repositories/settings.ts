import { eq } from "drizzle-orm";
import { settingsDb } from "../settingsClient";
import { appSettings } from "../schema/appSettings";

/** Key chứa model global legacy dùng cho Sky agent (fallback khi không có profile override). */
export const AGENT_MODEL_KEY = "agent.model";
/** Key chứa provider của Sky agent: opencode-go | openrouter. */
export const AGENT_PROVIDER_KEY = "agent.provider";
/** Key chứa JSON map `{profileId: modelId}` — model riêng cho từng agent profile. */
export const AGENT_MODELS_KEY = "agent.models";
export const AGENT_PROVIDERS = ["opencode-go", "openrouter"] as const;
export type AgentProvider = (typeof AGENT_PROVIDERS)[number];

// Bản sao cố ý của MODEL_ID_REGEX ở settingsRoutes (repo không import layer route).
const MODEL_ID_REGEX = /^[a-z0-9][a-z0-9/_:.-]{0,199}$/;
const PROFILE_KEY_REGEX = /^[a-z0-9-]{1,64}$/;
const MAX_MODEL_ENTRIES = 16;

/**
 * Parse `agent.models` từ DB. Trả `null` khi rác: JSON hỏng, không phải object phẳng,
 * entry >16, key profile sai dạng, value không phải model id hợp lệ. Đọc xong coi như
 * "chưa cài" — write path luôn validate trước khi lưu nên rác chỉ tồn tại khi DB bị đụng tay.
 */
export function parseAgentModels(raw: string): Record<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!PROFILE_KEY_REGEX.test(key)) return null;
    if (typeof value !== "string") return null;
    const model = value.trim();
    if (!MODEL_ID_REGEX.test(model)) return null;
    out[key] = model;
  }
  if (Object.keys(out).length > MAX_MODEL_ENTRIES) return null;
  return out;
}

/**
 * Epoch của lần force-release claims gần nhất (xem claimsRepo.reset). Monotonic: mỗi lần reset
 * tăng 1. Client so epoch đã lưu trong localStorage với epoch backend; lệch → bỏ pick của mình và
 * quay về picker, nên "force reset" có hiệu lực với cả tab đang mở, không chỉ row trong DB.
 */
export const CLAIMS_RESET_EPOCH_KEY = "claims.reset.epoch";

export interface AgentConfigSnapshot {
  provider: AgentProvider | null;
  model: string | null;
  models: Record<string, string> | null;
  updatedAt: number | null;
}

export interface AgentModelSetting {
  model: string;
  /** Unix ms. */
  updatedAt: number;
}

export const settingsRepo = {
  getAgentModel(): AgentModelSetting | null {
    const row = settingsDb().select().from(appSettings).where(eq(appSettings.key, AGENT_MODEL_KEY)).all()[0];
    if (!row) return null;
    return { model: row.value, updatedAt: row.updatedAt };
  },

  /** Provider hiệu lực từ DB, hoặc null khi chưa cài / giá trị rác. */
  getAgentProvider(): { provider: AgentProvider; updatedAt: number } | null {
    const row = settingsDb().select().from(appSettings).where(eq(appSettings.key, AGENT_PROVIDER_KEY)).all()[0];
    if (!row) return null;
    if (row.value !== "opencode-go" && row.value !== "openrouter") return null;
    return { provider: row.value, updatedAt: row.updatedAt };
  },

  /** Map `agent.models` đã parse + validate, hoặc null khi chưa cài / rác. */
  getAgentModels(): { models: Record<string, string>; updatedAt: number } | null {
    const row = settingsDb().select().from(appSettings).where(eq(appSettings.key, AGENT_MODELS_KEY)).all()[0];
    if (!row) return null;
    const models = parseAgentModels(row.value);
    if (!models) return null;
    return { models, updatedAt: row.updatedAt };
  },

  /**
   * Snapshot cho `/api/settings/agent-models` GET: provider/models (null khi chưa set), model legacy
   * raw, updatedAt = max của 2 key mới (agent.provider, agent.models) hoặc null.
   */
  getAgentConfigSnapshot(): AgentConfigSnapshot {
    const provider = settingsRepo.getAgentProvider();
    const models = settingsRepo.getAgentModels();
    const legacy = settingsRepo.getAgentModel();
    const stamps = [provider?.updatedAt, models?.updatedAt].filter((n): n is number => typeof n === "number");
    return {
      provider: provider?.provider ?? null,
      model: legacy?.model ?? null,
      models: models?.models ?? null,
      updatedAt: stamps.length > 0 ? Math.max(...stamps) : null,
    };
  },

  /**
   * Áp dụng provider/model/models trong MỘT transaction: mỗi field có mặt trong `update` là một thao
   * tác ghi (giá trị) hoặc xoá (null). `models` là thay thế toàn bộ map; object rỗng hoặc null ⇒ xoá key.
   * Caller chịu trách nhiệm validate (route layer) trước khi gọi. Trả về snapshot sau khi ghi.
   */
  applyAgentConfig(update: {
    provider?: AgentProvider | null;
    model?: string | null;
    models?: Record<string, string> | null;
  }): AgentConfigSnapshot {
    const now = Date.now();
    settingsDb().transaction((tx) => {
      const upsert = (key: string, value: string) => {
        tx.insert(appSettings)
          .values({ key, value, updatedAt: now })
          .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: now } })
          .run();
      };
      const remove = (key: string) => {
        tx.delete(appSettings).where(eq(appSettings.key, key)).run();
      };
      if (update.provider !== undefined) {
        if (update.provider === null) remove(AGENT_PROVIDER_KEY);
        else upsert(AGENT_PROVIDER_KEY, update.provider);
      }
      if (update.model !== undefined) {
        if (update.model === null) remove(AGENT_MODEL_KEY);
        else upsert(AGENT_MODEL_KEY, update.model);
      }
      if (update.models !== undefined) {
        if (update.models === null || Object.keys(update.models).length === 0) remove(AGENT_MODELS_KEY);
        else upsert(AGENT_MODELS_KEY, JSON.stringify(update.models));
      }
    });
    return settingsRepo.getAgentConfigSnapshot();
  },

  setAgentModel(model: string): AgentModelSetting {
    const now = Date.now();
    settingsDb().insert(appSettings)
      .values({ key: AGENT_MODEL_KEY, value: model, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: model, updatedAt: now },
      })
      .run();
    return { model, updatedAt: now };
  },

  /**
   * Epoch reset claims hiện tại. Thiếu row / giá trị rác ("banana", "0", "-5") → 0: client chỉ
   * cần một số nguyên không âm để so sánh, không bao giờ được ném lỗi vì nội dung DB.
   */
  getClaimsResetEpoch(): number {
    const row = settingsDb()
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, CLAIMS_RESET_EPOCH_KEY))
      .all()[0];
    if (!row) return 0;
    const parsed = Number.parseInt(row.value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  },

  /** Tăng epoch thêm 1 và trả về giá trị mới (cùng pattern upsert như setAgentModel). */
  bumpClaimsResetEpoch(): number {
    const next = settingsRepo.getClaimsResetEpoch() + 1;
    const now = Date.now();
    settingsDb().insert(appSettings)
      .values({ key: CLAIMS_RESET_EPOCH_KEY, value: String(next), updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: String(next), updatedAt: now },
      })
      .run();
    return next;
  },
};
