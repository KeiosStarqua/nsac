import { z } from "zod";
import { claimsRepo } from "./db/repositories/claims";

// sessionId do client tự tạo (crypto.randomUUID), không phải danh tính thật: chỉ đủ để phân biệt
// trình duyệt trong demo. Lenient như phần còn lại — định dạng sai thì coi như không có.
const sessionIdSchema = z.string().min(8).max(128);

const claimBodySchema = z.object({
  sessionId: sessionIdSchema,
  astronautId: z.string().trim().min(1),
});

/**
 * Xử lý các route /api/claims*. Trả về `null` khi pathname không thuộc claims để server.ts
 * tiếp tục fall-through về 404 như hiện có. Không log/echo sessionId của người khác.
 */
export async function handleClaimsRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);

  if (url.pathname === "/api/claims") {
    if (req.method === "GET") {
      // Lenient: sessionId thiếu/sai định dạng → tất cả mine=false.
      const raw = url.searchParams.get("sessionId");
      const parsed = sessionIdSchema.safeParse(raw);
      const sessionId = parsed.success ? parsed.data : undefined;
      const claims = await claimsRepo.list(sessionId);
      return Response.json(claims);
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
    // Chỉ dành cho demo/test: xóa sạch claims, không có auth theo thiết kế trên demo box,
    // không được public-phô bày — endpoint này không có UI, chỉ gọi tay hoặc từ script test.
    const cleared = claimsRepo.reset();
    return Response.json({ ok: true, cleared });
  }

  return null;
}
