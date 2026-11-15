import { eq } from "drizzle-orm";
import { settingsDb } from "../settingsClient";
import { appSettings } from "../schema/appSettings";

/** Key chứa model OpenRouter dùng cho Sky agent (orchestrator/composer/chat). */
export const AGENT_MODEL_KEY = "agent.model";

/**
 * Epoch của lần force-release claims gần nhất (xem claimsRepo.reset). Monotonic: mỗi lần reset
 * tăng 1. Client so epoch đã lưu trong localStorage với epoch backend; lệch → bỏ pick của mình và
 * quay về picker, nên "force reset" có hiệu lực với cả tab đang mở, không chỉ row trong DB.
 */
export const CLAIMS_RESET_EPOCH_KEY = "claims.reset.epoch";

/**
 * ElevenLabs API key cho Sky TTS. Write-only theo hợp đồng: không GET nào trả về key này
 * (`/api/settings/elevenlabs-key` chỉ trả `{ configured, updatedAt }`); chỉ route TTS nội bộ
 * được phép đọc giá trị thật qua `getElevenLabsKey()`.
 */
export const ELEVENLABS_KEY = "elevenlabs.api_key";

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
