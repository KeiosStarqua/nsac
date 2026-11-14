import { eq } from "drizzle-orm";
import { settingsDb as db } from "../settingsClient";
import { appSettings } from "../schema/appSettings";

/** Key chứa model OpenRouter dùng cho Sky agent (orchestrator/composer/chat). */
export const AGENT_MODEL_KEY = "agent.model";

export interface AgentModelSetting {
  model: string;
  /** Unix ms. */
  updatedAt: number;
}

export const settingsRepo = {
  getAgentModel(): AgentModelSetting | null {
    const row = db.select().from(appSettings).where(eq(appSettings.key, AGENT_MODEL_KEY)).all()[0];
    if (!row) return null;
    return { model: row.value, updatedAt: row.updatedAt };
  },

  setAgentModel(model: string): AgentModelSetting {
    const now = Date.now();
    db.insert(appSettings)
      .values({ key: AGENT_MODEL_KEY, value: model, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: model, updatedAt: now },
      })
      .run();
    return { model, updatedAt: now };
  },
};
