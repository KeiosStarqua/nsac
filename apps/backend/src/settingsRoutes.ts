import { z } from "zod";
import { settingsRepo } from "./db/repositories/settings";

// Model id OpenRouter: không khoảng trắng, không ký tự lạ — chống injection/giá trị rác.
// Không kiểm tra catalog ở đây: backend không gọi mạng, caller (trang admin) chịu trách nhiệm tra catalog.
export const MODEL_ID_REGEX = /^[a-z0-9][a-z0-9/_:.-]{0,199}$/;
const modelIdSchema = z.string().trim().regex(MODEL_ID_REGEX);

// ElevenLabs key dạng `sk_<hex-ish>`; regex cố tình rộng (10..512, không khoảng trắng/ký tự lạ)
// để không phụ thuộc một format cụ thể của nhà cung cấp.
export const ELEVENLABS_KEY_REGEX = /^[A-Za-z0-9_\-]{10,512}$/;
const elevenLabsKeySchema = z.string().trim().regex(ELEVENLABS_KEY_REGEX);

const putModelBodySchema = z.object({
  model: modelIdSchema,
});

const putElevenLabsKeyBodySchema = z.object({
  key: elevenLabsKeySchema,
});

/**
 * Xử lý route settings: `/api/settings/agent-model` (GET/PUT) và `/api/settings/elevenlabs-key`
 * (GET/PUT/DELETE). Trả về `null` khi pathname/method không thuộc settings để server.ts tiếp tục
 * fall-through về 404 như hiện có. Key ElevenLabs là write-only: GET chỉ trả trạng thái, không
 * bao giờ trả giá trị.
 */
export async function handleSettingsRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname === "/api/settings/agent-model") return handleAgentModel(req);
  if (url.pathname === "/api/settings/elevenlabs-key") return handleElevenLabsKey(req);
  return null;
}

async function handleAgentModel(req: Request): Promise<Response | null> {
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
    const parsed = putModelBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ ok: false, error: "bad_model" }, { status: 400 });
    }
    const saved = settingsRepo.setAgentModel(parsed.data.model);
    return Response.json({ ok: true, model: saved.model, updatedAt: saved.updatedAt });
  }

  return null;
}

async function handleElevenLabsKey(req: Request): Promise<Response | null> {
  if (req.method === "GET") {
    const status = settingsRepo.getElevenLabsStatus();
    return Response.json(status);
  }

  if (req.method === "PUT") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
    }
    const parsed = putElevenLabsKeyBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ ok: false, error: "bad_key" }, { status: 400 });
    }
    const saved = settingsRepo.setElevenLabsKey(parsed.data.key);
    // Không echo key — chỉ thời điểm lưu.
    return Response.json({ ok: true, updatedAt: saved.updatedAt });
  }

  if (req.method === "DELETE") {
    const cleared = settingsRepo.clearElevenLabsKey();
    return Response.json({ ok: true, cleared });
  }

  return null;
}
