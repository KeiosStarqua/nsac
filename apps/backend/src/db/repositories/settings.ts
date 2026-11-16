import { eq } from "drizzle-orm";
import { settingsDb } from "../settingsClient";
import { appSettings } from "../schema/appSettings";

/** Key chứa model global legacy dùng cho Sky agent (fallback khi không có profile override). */
export const AGENT_MODEL_KEY = "agent.model";
/** Key chứa provider của Sky agent: opencode-go | openrouter | amazon-bedrock. */
export const AGENT_PROVIDER_KEY = "agent.provider";
/** Key chứa JSON map `{profileId: modelId}` — model riêng cho từng agent profile. */
export const AGENT_MODELS_KEY = "agent.models";
export const AGENT_PROVIDERS = ["opencode-go", "openrouter", "amazon-bedrock"] as const;
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

/**
 * Speech Engine id (ElevenLabs) — public instance handle, không phải secret. Resolution order:
 * env `ELEVENLABS_SPEECH_ENGINE_ID` thắng; DB row này là fallback khi env chưa set.
 */
export const SPEECH_ENGINE_ID_KEY = "speech_engine.id";

/**
 * ElevenLabs API key cho Sky TTS. Write-only theo hợp đồng: không GET nào trả về key này
 * (`/api/settings/elevenlabs-key` chỉ trả `{ configured, updatedAt }`); chỉ route TTS nội bộ
 * được phép đọc giá trị thật qua `getElevenLabsKey()`.
 */
export const ELEVENLABS_KEY = "elevenlabs.api_key";

/**
 * Backdrop của dashboard `/` — admin-only setting, web đọc qua loopback GET
 * `/api/settings/hud-background`. Chỉ hai React Bits component tồn tại: `particles` (default) và
 * `galaxy`; precedence `?bg=`/localStorage cũ đã bị gỡ, admin luôn thắng.
 */
export const HUD_BACKGROUND_KEY = "hud.background";
export const HUD_BACKGROUNDS = ["particles", "galaxy"] as const;
export type HudBackground = (typeof HUD_BACKGROUNDS)[number];

export interface HudBackgroundSetting {
  background: HudBackground;
  /** Unix ms. */
  updatedAt: number;
}

/**
/**
 * Core chạy agent (dual-core, HARNESSING §18): `pi` (PI SDK — mặc định, hành vi hiện tại) hoặc
 * `mastra` (beta, `@mastra/core`). Admin-only setting, web đọc qua loopback
 * `GET /api/settings/agent-core`; chưa set / rác ⇒ `pi`. Orthogonal với provider/model.
 */
export const AGENT_CORE_KEY = "agent.core";
export const AGENT_CORES = ["pi", "mastra"] as const;
export type AgentCore = (typeof AGENT_CORES)[number];

export interface AgentCoreSetting {
  core: AgentCore;
  /** Unix ms. */
  updatedAt: number;
}

/**
 * Giao diện của console `/` — admin-only setting, web đọc qua loopback GET
 * `/api/settings/hud-ui`. `mock` (default) = `SkyHudMock` ba cột; `gen` = cây OpenUI
 * khai báo của `features/hud-gen`. `?arch=openui` vẫn là dev override theo từng lần tải.
 */
export const HUD_UI_KEY = "hud.ui";
export const HUD_UIS = ["mock", "gen"] as const;
export type HudUi = (typeof HUD_UIS)[number];

export interface HudUiSetting {
  ui: HudUi;
  /** Unix ms. */
  updatedAt: number;
}

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

export interface ElevenLabsKeySetting {
  key: string;
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
    if (row.value !== "opencode-go" && row.value !== "openrouter" && row.value !== "amazon-bedrock") return null;
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
   * Đọc key thật — CHỈ route `/api/tts` được gọi hàm này. Mọi surface khác phải dùng
   * `getElevenLabsStatus()` (không lộ giá trị).
   */
  getElevenLabsKey(): ElevenLabsKeySetting | null {
    const row = settingsDb().select().from(appSettings).where(eq(appSettings.key, ELEVENLABS_KEY)).all()[0];
    if (!row) return null;
    return { key: row.value, updatedAt: row.updatedAt };
  },

  /** Trạng thái không lộ giá trị — đây là thứ duy nhất được phép trả về client. */
  getElevenLabsStatus(): { configured: boolean; updatedAt: number | null } {
    const row = settingsDb().select({ updatedAt: appSettings.updatedAt }).from(appSettings).where(eq(appSettings.key, ELEVENLABS_KEY)).all()[0];
    return row ? { configured: true, updatedAt: row.updatedAt } : { configured: false, updatedAt: null };
  },

  setElevenLabsKey(key: string): ElevenLabsKeySetting {
    const now = Date.now();
    settingsDb().insert(appSettings)
      .values({ key: ELEVENLABS_KEY, value: key, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: key, updatedAt: now },
      })
      .run();
    return { key, updatedAt: now };
  },

  /** Xoá row; trả về `true` nếu trước đó có key. */
  clearElevenLabsKey(): boolean {
    const existed = settingsRepo.getElevenLabsKey() !== null;
    if (!existed) return false;
    settingsDb().delete(appSettings).where(eq(appSettings.key, ELEVENLABS_KEY)).run();
    return true;
  },

  /**
   * Speech Engine id trong DB (fallback khi env `ELEVENLABS_SPEECH_ENGINE_ID` chưa set).
   * Engine id là public instance handle — được phép hiển thị cho admin; vẫn không log lung tung.
   */
  getSpeechEngineId(): { engineId: string; updatedAt: number } | null {
    const row = settingsDb().select().from(appSettings).where(eq(appSettings.key, SPEECH_ENGINE_ID_KEY)).all()[0];
    if (!row) return null;
    const engineId = row.value.trim();
    if (!engineId) return null;
    return { engineId, updatedAt: row.updatedAt };
  },

  setSpeechEngineId(engineId: string): { engineId: string; updatedAt: number } {
    const now = Date.now();
    settingsDb().insert(appSettings)
      .values({ key: SPEECH_ENGINE_ID_KEY, value: engineId, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: engineId, updatedAt: now },
      })
      .run();
    return { engineId, updatedAt: now };
  },

  /** Xoá row; trả về `true` nếu trước đó có id. */
  clearSpeechEngineId(): boolean {
    const existed = settingsRepo.getSpeechEngineId() !== null;
    if (!existed) return false;
    settingsDb().delete(appSettings).where(eq(appSettings.key, SPEECH_ENGINE_ID_KEY)).run();
    return true;
  },

  /**
   * Core hiệu lực của Sky agent, hoặc null khi chưa set / giá trị rác (hands-on DB edit).
   * `null` nghĩa là caller dùng default `pi` — route GET tự map.
   */
  getAgentCore(): AgentCoreSetting | null {
    const row = settingsDb().select().from(appSettings).where(eq(appSettings.key, AGENT_CORE_KEY)).all()[0];
    if (!row) return null;
    const value = row.value.trim();
    if (!(AGENT_CORES as readonly string[]).includes(value)) return null;
    return { core: value as AgentCore, updatedAt: row.updatedAt };
  },

  setAgentCore(core: AgentCore): AgentCoreSetting {
    const now = Date.now();
    settingsDb().insert(appSettings)
      .values({ key: AGENT_CORE_KEY, value: core, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: core, updatedAt: now },
      })
      .run();
    return { core, updatedAt: now };
  },

  /**
   * Backdrop hiệu lực của `/`, hoặc null khi chưa set / giá trị rác (hands-on DB edit, row cũ).
   * `null` nghĩa là caller dùng default `particles` — route GET tự map.
   */
  getHudBackground(): HudBackgroundSetting | null {
    const row = settingsDb().select().from(appSettings).where(eq(appSettings.key, HUD_BACKGROUND_KEY)).all()[0];
    if (!row) return null;
    const value = row.value.trim();
    if (!(HUD_BACKGROUNDS as readonly string[]).includes(value)) return null;
    return { background: value as HudBackground, updatedAt: row.updatedAt };
  },

  setHudBackground(background: HudBackground): HudBackgroundSetting {
    const now = Date.now();
    settingsDb().insert(appSettings)
      .values({ key: HUD_BACKGROUND_KEY, value: background, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: background, updatedAt: now },
      })
      .run();
    return { background, updatedAt: now };
  },

  /**
   * Giao diện hiệu lực của `/`, hoặc null khi chưa set / giá trị rác (hands-on DB edit, row cũ).
   * `null` nghĩa là caller dùng default `mock` — route GET tự map.
   */
  getHudUi(): HudUiSetting | null {
    const row = settingsDb().select().from(appSettings).where(eq(appSettings.key, HUD_UI_KEY)).all()[0];
    if (!row) return null;
    const value = row.value.trim();
    if (!(HUD_UIS as readonly string[]).includes(value)) return null;
    return { ui: value as HudUi, updatedAt: row.updatedAt };
  },

  setHudUi(ui: HudUi): HudUiSetting {
    const now = Date.now();
    settingsDb().insert(appSettings)
      .values({ key: HUD_UI_KEY, value: ui, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: ui, updatedAt: now },
      })
      .run();
    return { ui, updatedAt: now };
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
