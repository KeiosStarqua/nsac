import { z } from "zod";
import { settingsRepo, AGENT_PROVIDERS, type AgentProvider } from "./db/repositories/settings";

// Model id OpenRouter/OpenCode Go: không khoảng trắng, không ký tự lạ — chống injection/giá trị rác.
// Không kiểm tra catalog ở đây: backend không gọi mạng, caller (trang admin) chịu trách nhiệm tra catalog.
export const MODEL_ID_REGEX = /^[a-z0-9][a-z0-9/_:.-]{0,199}$/;
const modelIdSchema = z.string().trim().regex(MODEL_ID_REGEX);

// Key của map `agent.models`: id profile dạng kebab (vd. sky-chat), ≤64 ký tự.
const PROFILE_KEY_REGEX = /^[a-z0-9-]{1,64}$/;
const MAX_MODEL_ENTRIES = 16;

const putBodySchema = z.object({
  model: modelIdSchema,
});

const providerSchema = z.enum(AGENT_PROVIDERS as [AgentProvider, ...AgentProvider[]]);

/**
 * Thân PUT /api/settings/agent-models: mọi field đều optional, `null` = xoá key tương ứng.
 * Validate thủ công (thay vì một schema zod lớn) để mỗi lỗi trả đúng mã error riêng.
 */
const putConfigBodySchema = z.object({
  provider: z.unknown().optional(),
  model: z.unknown().optional(),
  models: z.unknown().optional(),
});

type AgentModelsMap = Record<string, string>;

function validateAgentConfigBody(body: unknown):
  | { ok: true; update: { provider?: AgentProvider | null; model?: string | null; models?: AgentModelsMap | null } }
  | { ok: false; error: string } {
  const parsed = putConfigBodySchema.safeParse(body);
  if (!parsed.success || typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "bad_body" };
  }
  const update: { provider?: AgentProvider | null; model?: string | null; models?: AgentModelsMap | null } = {};

  if (parsed.data.provider !== undefined) {
    const raw = parsed.data.provider;
    if (raw === null) {
      update.provider = null;
    } else {
      const p = providerSchema.safeParse(typeof raw === "string" ? raw.trim() : raw);
      if (!p.success) return { ok: false, error: "bad_provider" };
      update.provider = p.data;
    }
  }

  if (parsed.data.model !== undefined) {
    const raw = parsed.data.model;
    if (raw === null) {
      update.model = null;
    } else {
      const m = modelIdSchema.safeParse(raw);
      if (!m.success) return { ok: false, error: "bad_model" };
      update.model = m.data;
    }
  }

  if (parsed.data.models !== undefined) {
    const raw = parsed.data.models;
    if (raw === null) {
      update.models = null;
    } else {
      if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "bad_models" };
      const out: AgentModelsMap = {};
      for (const [key, value] of Object.entries(raw)) {
        if (!PROFILE_KEY_REGEX.test(key)) return { ok: false, error: "bad_models" };
        const m = modelIdSchema.safeParse(value);
        if (!m.success) return { ok: false, error: "bad_models" };
        out[key] = m.data;
      }
      if (Object.keys(out).length > MAX_MODEL_ENTRIES) return { ok: false, error: "bad_models" };
      // `{}` = xoá key theo contract (toàn bộ override về mặc định).
      update.models = out;
    }
  }

  return { ok: true, update };
}

/**
 * Xử lý route /api/settings/agent-model (legacy global, giữ nguyên hành vi cũ) và
 * /api/settings/agent-models (provider + per-profile models). Trả về `null` khi pathname/method
 * không thuộc settings để server.ts tiếp tục fall-through về 404 như hiện có.
 */
export async function handleSettingsRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);

  if (url.pathname === "/api/settings/agent-model") {
    if (req.method === "GET") {
      const current = settingsRepo.getAgentModel();
      return Response.json({ model: current?.model ?? null, updatedAt: current?.updatedAt ?? null });
    }

    if (req.method === "PUT") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
      }
      const parsed = putBodySchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ ok: false, error: "bad_model" }, { status: 400 });
      }
      const saved = settingsRepo.setAgentModel(parsed.data.model);
      return Response.json({ ok: true, model: saved.model, updatedAt: saved.updatedAt });
    }

    return null;
  }

  if (url.pathname === "/api/settings/agent-models") {
    if (req.method === "GET") {
      const snap = settingsRepo.getAgentConfigSnapshot();
      return Response.json(snap);
    }

    if (req.method === "PUT") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
      }
      const parsed = validateAgentConfigBody(body);
      if (!parsed.ok) {
        return Response.json({ ok: false, error: parsed.error }, { status: 400 });
      }
      const snap = settingsRepo.applyAgentConfig(parsed.update);
      return Response.json({ ok: true, ...snap });
    }

    return null;
  }

  return null;
}
