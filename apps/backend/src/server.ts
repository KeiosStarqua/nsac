import { astronautsRepo } from "./db/repositories/astronauts";
import { handleClaimsRequest } from "./claimsRoutes";

const port = Number(process.env.PORT ?? 3200);

await astronautsRepo.seed();

Bun.serve({
  port,
  // Mặc định chỉ lắng nghe 127.0.0.1: route ẩn (/api/claims/reset) không được lộ ra LAN/public; dev override bằng HOST.
  hostname: process.env.HOST ?? "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }
    const claims = await handleClaimsRequest(req);
    if (claims) return claims;
    if (url.pathname === "/api/astronauts") {
      const rows = await astronautsRepo.list();
      return Response.json(rows);
    }
    const m = url.pathname.match(/^\/api\/astronauts\/([^/]+)$/);
    if (m) {
      const row = await astronautsRepo.get(decodeURIComponent(m[1]));
      if (!row) return new Response("not found", { status: 404 });
      return Response.json(row);
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`backend listening on ${port}`);