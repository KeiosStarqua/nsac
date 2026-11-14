import { astronautsRepo } from "./db/repositories/astronauts";
import { handleClaimsRequest } from "./claimsRoutes";
import { handleSettingsRequest } from "./settingsRoutes";
import { eventsBus, handleEventsRequest } from "./eventsRoutes";
import { handleSensorsRequest } from "./sensors/routes";
import { wsHandlers } from "./sensors/ws";

const port = Number(process.env.PORT ?? 3200);

// Quan sát tối thiểu cho bus in-process v1 — mọi thứ khác trên bus vẫn là data, không log thêm.
eventsBus.on("published", (event: { id: number; topic: string }) => {
  console.log(`[events] ${event.id} ${event.topic}`);
});

await astronautsRepo.seed();

Bun.serve({
  port,
  // Mặc định chỉ lắng nghe 127.0.0.1: route ẩn (/api/claims/reset) không được lộ ra LAN/public; dev override bằng HOST.
  hostname: process.env.HOST ?? "127.0.0.1",
  async fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }
    if (url.pathname === "/ws/telemetry") {
      // Nâng cấp lên websocket cho telemetry synthetic (SPEC §8.2).
      if (server.upgrade(req)) return undefined;
      return new Response("websocket upgrade failed", { status: 400 });
    }
    const claims = await handleClaimsRequest(req);
    if (claims) return claims;
    const settings = await handleSettingsRequest(req);
    if (settings) return settings;
    const events = await handleEventsRequest(req);
    if (events) return events;
    const sensors = await handleSensorsRequest(req);
    if (sensors) return sensors;
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
  websocket: wsHandlers,
});

console.log(`backend listening on ${port}`);
