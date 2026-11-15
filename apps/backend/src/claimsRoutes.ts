import { z } from "zod";
import { claimsRepo } from "./db/repositories/claims";
import { settingsRepo } from "./db/repositories/settings";

// sessionId do client tự tạo (crypto.randomUUID), không phải danh tính thật: chỉ đủ để phân biệt
// trình duyệt trong demo. Lenient như phần còn lại — định dạng sai thì coi như không có.
const sessionIdSchema = z.string().min(8).max(128);

const claimBodySchema = z.object({
  sessionId: sessionIdSchema,
  astronautId: z.string().trim().min(1),
});

const heartbeatBodySchema = z.object({
  sessionId: sessionIdSchema,
});

/**
 * Xử lý các route /api/claims*. Trả về `null` khi pathname không thuộc claims để server.ts
 * tiếp tục fall-through về 404 như hiện có (mọi method khác cũng vậy: chỉ đúng method của
 * từng route mới được xử lý). Không log/echo sessionId của người khác.
 */
export async function handleClaimsRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);

  if (url.pathname === "/api/claims/heartbeat") {
    // Heartbeat chỉ làm mới claim đang có; không tạo claim, không trả gì về session khác.
    if (req.method !== "POST") return null;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
    }
    const parsed = heartbeatBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
    }
    const { refreshed } = claimsRepo.heartbeat(parsed.data.sessionId);
    return Response.json({ ok: true, refreshed });
  }

  if (url.pathname === "/api/claims") {
    if (req.method === "GET") {
      // Lenient: sessionId thiếu/sai định dạng → tất cả mine=false.
      const raw = url.searchParams.get("sessionId");
      const parsed = sessionIdSchema.safeParse(raw);
      const sessionId = parsed.success ? parsed.data : undefined;
      const claims = await claimsRepo.list(sessionId);
      // `epoch` đi kèm mọi lần đọc: client so với giá trị đã lưu để biết có force reset ở nơi
      // khác hay không (đọc mỗi request, một row app_settings — rẻ).
      return Response.json({ claims, epoch: settingsRepo.getClaimsResetEpoch() });
    }
    if (req.method === "POST") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
      }
      const parsed = claimBodySchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
      }
      const result = claimsRepo.claim(parsed.data.sessionId, parsed.data.astronautId);
      if (result.status === "not_found") {
        return Response.json({ ok: false, error: "unknown_astronaut" }, { status: 400 });
      }
      if (result.status === "taken") {
        return Response.json({ ok: false, error: "taken" }, { status: 409 });
      }
      return Response.json({ ok: true });
    }
    return null;
  }

  if (url.pathname === "/api/claims/reset") {
    if (req.method !== "POST") return null;
    // Chỉ dành cho demo/test: xóa sạch claims + bump epoch, không có auth theo thiết kế trên demo
    // box — người dùng mới bị kẹt ở một phi hành đoàn đầy phải gỡ được chỗ. Epoch đổi là tín hiệu
    // để mọi tab đang mở bỏ pick của mình (web poll 45 s, xem useClaimsWatcher).
    const { cleared, epoch } = claimsRepo.reset();
    return Response.json({ ok: true, cleared, epoch });
  }

  return null;
}
