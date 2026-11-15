import { z } from "zod";
import { agentTracesRepo } from "./db/repositories/agentTraces";

// Endpoint mở (demo, bind 127.0.0.1) — cùng posture với /api/events. Body nhỏ, mọi field cap,
// không bao giờ nhận tool arguments: chỉ {name, ok?, ms?}. Lỗi luôn JSON { ok: false, error }.
const MAX_BODY_BYTES = 12 * 1024;

const toolSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    ok: z.boolean().optional(),
    ms: z.number().int().min(0).max(3_600_000).optional(),
  })
  .strict();

const postBodySchema = z
  .object({
    astronautId: z.string().trim().min(1).max(64),
    agentId: z.string().trim().min(1).max(64),
    sessionId: z.string().trim().min(1).max(128).optional(),
    provider: z.string().trim().min(1).max(64).optional(),
    model: z.string().trim().min(1).max(200).optional(),
    ok: z.boolean(),
    errorCode: z.string().trim().min(1).max(64).optional(),
    latencyMs: z.number().int().min(0).max(3_600_000),
    userText: z.string().min(1).max(4000),
    replyText: z.string().max(4000).optional(),
    tools: z.array(toolSchema).max(20).optional(),
  })
  .strict();

const lenientInt = (raw: string | null, fallback: number, min: number, max: number): number => {
  const n = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

/**
 * Route /api/agent-traces*. Trả `null` khi pathname không thuộc module để server.ts fall-through
 * như claims/settings/tts. POST ghi một trace (web gọi best-effort sau mỗi turn); GET đọc cho
 * coding agents (filter + newest first, limit ≤ 200); GET /:id đọc một row.
 */
export async function handleAgentTraceRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);

  if (url.pathname === "/api/agent-traces") {
    if (req.method === "POST") return postTrace(req);
    if (req.method === "GET") return listTraces(url);
    return null;
  }

  const m = url.pathname.match(/^\/api\/agent-traces\/(\d+)$/);
  if (m) {
    if (req.method !== "GET") return null;
    const row = agentTracesRepo.getTrace(Number(m[1]));
    if (!row) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return Response.json(row);
  }

  return null;
}

async function postTrace(req: Request): Promise<Response> {
  // Chặn sớm theo Content-Length khi có; luôn kiểm tra lại sau khi đọc body.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const { id } = agentTracesRepo.insertTrace(parsed.data);
  return Response.json({ id }, { status: 201 });
}

function listTraces(url: URL): Response {
  const astronautId = url.searchParams.get("astronautId")?.trim().slice(0, 64) || undefined;
  const agentId = url.searchParams.get("agentId")?.trim().slice(0, 64) || undefined;
  // ok chỉ nhận true|false|1|0; giá trị lạ → bỏ qua filter (lenient như phần còn lại).
  const rawOk = url.searchParams.get("ok")?.trim().toLowerCase();
  const ok = rawOk === "true" || rawOk === "1" ? true : rawOk === "false" || rawOk === "0" ? false : undefined;
  const rawSince = url.searchParams.get("since");
  const sinceNum = rawSince === null ? NaN : Number(rawSince);
  const since = Number.isFinite(sinceNum) ? Math.max(0, Math.trunc(sinceNum)) : undefined;
  const limit = lenientInt(url.searchParams.get("limit"), 50, 1, 200);
  const rows = agentTracesRepo.listTraces({ astronautId, agentId, ok, since, limit });
  return Response.json({ rows, limit });
}
