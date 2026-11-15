import { z } from "zod";
import { settingsRepo } from "./db/repositories/settings";

// Sky TTS: proxy tới ElevenLabs cho chat replies trên `/`. Key ElevenLabs nằm trong app_settings
// (write-only, xem settings.ts) — route này là nơi DUY NHẤT được phép đọc giá trị thật.
// Không bao giờ log key, không bao giờ trả key ra client, không log body upstream.

const MAX_BODY_BYTES = 8192;
const TTS_TIMEOUT_MS = 25_000;
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // premade "Rachel"
// eleven_flash_v2_5 — model low-latency, hỗ trợ Vietnamese (32 ngôn ngữ).
// https://elevenlabs.io/docs/help-center/technical/what-models-do-you-offer-and-what-is-the-difference-between-them
const MODEL_ID = "eleven_flash_v2_5";

const ttsBodySchema = z.object({
  text: z.string().min(1).max(1000),
});

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Xử lý route `/api/tts`. Trả về `null` khi path/method không thuộc module để server.ts
 * fall-through về 404 như hiện có. Lỗi luôn JSON `{ ok: false, error }`.
 */
export async function handleTtsRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname !== "/api/tts") return null;
  if (req.method !== "POST") return null;

  // Chặn sớm theo Content-Length khi có; luôn kiểm tra lại sau khi đọc body (giống eventsRoutes).
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }

  const body = safeJsonParse(text);
  if (body === undefined) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const parsed = ttsBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const setting = settingsRepo.getElevenLabsKey();
  if (!setting) {
    return Response.json({ ok: false, error: "tts_not_configured" }, { status: 503 });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": setting.key,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({ text: parsed.data.text, model_id: MODEL_ID }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Chỉ log status code — không log key, không log body upstream (có thể chứa chi tiết tài khoản).
      console.error(`[tts] upstream status ${res.status}`);
      return Response.json({ ok: false, error: "tts_upstream" }, { status: 502 });
    }
    const audio = await res.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch {
    if (controller.signal.aborted) {
      return Response.json({ ok: false, error: "tts_timeout" }, { status: 504 });
    }
    // Mất mạng / DNS / TLS — coi như upstream fail (không phân biệt với non-2xx).
    console.error("[tts] upstream fetch failed");
    return Response.json({ ok: false, error: "tts_upstream" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
