import { z } from "zod";
import { settingsRepo } from "./db/repositories/settings";

// Model id OpenRouter: không khoảng trắng, không ký tự lạ — chống injection/giá trị rác.
// Không kiểm tra catalog ở đây: backend không gọi mạng, caller (trang admin) chịu trách nhiệm tra catalog.
export const MODEL_ID_REGEX = /^[a-z0-9][a-z0-9/_:.-]{0,199}$/;
const modelIdSchema = z.string().trim().regex(MODEL_ID_REGEX);

const putBodySchema = z.object({
  model: modelIdSchema,
});

/**
 * Xử lý route /api/settings/agent-model. Trả về `null` khi pathname/method không thuộc settings
 * để server.ts tiếp tục fall-through về 404 như hiện có.
 */
export async function handleSettingsRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname !== "/api/settings/agent-model") return null;

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
