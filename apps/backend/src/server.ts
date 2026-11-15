import { astronautsRepo } from "./db/repositories/astronauts";
import { claimsRepo } from "./db/repositories/claims";
import { handleClaimsRequest } from "./claimsRoutes";
import { handleAgentTraceRequest } from "./agentTraceRoutes";
import { handleSettingsRequest } from "./settingsRoutes";
import { handleTtsRequest } from "./ttsRoutes";
import { eventsBus, handleEventsRequest } from "./eventsRoutes";
import { handleSensorsRequest } from "./sensors/routes";
import { wsHandlers } from "./sensors/ws";
import { handleClinicalRequest } from "./clinical/routes";
import { startClinicalScheduler } from "./clinical/scheduler";
import { handleHealthRequest } from "./healthRoutes";
import { handleSpeechRequest, startSpeechEngine } from "./speechEngine";
import { handleSpeechAdminRequest } from "./speechAdmin";
import { seedHealthObservations } from "./health/seed";
import { startHealthProjector } from "./health/projector";
import { bootSimulation } from "./sensors/runtime";

const port = Number(process.env.PORT ?? 3200);

// Quan sát tối thiểu cho bus in-process v1 — mọi thứ khác trên bus vẫn là data, không log thêm.
eventsBus.on("published", (event: { id: number; topic: string }) => {
  console.log(`[events] ${event.id} ${event.topic}`);
});

await astronautsRepo.seed();

// Claim TTL: giải phóng claim idle ngay khi start, rồi quét mỗi phút. list()/claim()/heartbeat()
// vẫn quét lười, interval này chỉ để row hết hạn không nằm lại khi không ai gọi API.
try {
  const released = claimsRepo.sweepStale();
  if (released > 0) console.log(`[claims] released ${released} stale claim(s)`);
} catch (e) {
  console.error("[claims] sweep failed", e);
}
const claimsSweep = setInterval(() => {
  try {
    const released = claimsRepo.sweepStale();
    if (released > 0) console.log(`[claims] released ${released} stale claim(s)`);
  } catch (e) {
    console.error("[claims] sweep failed", e);
  }
}, 60_000);
claimsSweep.unref?.();

// Health observation layer: seed idempotent một lần sau khi crew tồn tại (FK). Chỉ ghi cặp
// (astronaut, metric) đang rỗng nên restart không nhân đôi; dữ liệu synthetic, xem health/seed.ts.
const healthSeed = await seedHealthObservations();
if (healthSeed.inserted > 0) {
  console.log(`[health] seeded ${healthSeed.inserted} observation rows`);
}

// Speech Engine (ElevenLabs): websocket loopback cho voice chat `/` — cùng process, port riêng.
// Thiếu engine id / API key thì chỉ HTTP routes chạy; JWT verify luôn bật.
startSpeechEngine();

// Clinical routine engine (HARNESSING §17): deterministic, không LLM; tick CLINICAL_TICK_SECONDS.
startClinicalScheduler();

// Health projector: nghe frame telemetry đã persist → health_current/rollups + rules → facts.
// Đăng ký TRƯỚC bootSimulation để frame đầu tiên không bị lỡ. Không cần key/mạng.
startHealthProjector();

// Continuous simulator (SPEC §14 v2, PR1): autostart mission SIM-001 khi SKY_SIM_AUTOSTART=1,
// restore durable session nếu có, checkpoint 60 tick + retention telemetry. Phải chạy SAU seed
// (FK astronauts) và TRƯỚC listen để /api/health/live có dữ liệu ngay khi server mở port.
bootSimulation();

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
    const agentTraces = await handleAgentTraceRequest(req);
    if (agentTraces) return agentTraces;
    const settings = await handleSettingsRequest(req);
    if (settings) return settings;
    // Speech Engine admin surface (loopback-only) — trước speech fall-through.
    const speechAdmin = await handleSpeechAdminRequest(req);
    if (speechAdmin) return speechAdmin;
    // Speech Engine HTTP surface (register/config) — trước tts theo thứ tự fall-through.
    const speech = await handleSpeechRequest(req);
    if (speech) return speech;
    const tts = await handleTtsRequest(req);
    if (tts) return tts;
    const events = await handleEventsRequest(req);
    if (events) return events;
    // Sensors trước clinical: clinical đọc telemetry_events (read-only) của sensors.
    const sensors = await handleSensorsRequest(req);
    if (sensors) return sensors;
    // Clinical routine engine (findings / routines) — sau sensors, trước health.
    const clinical = await handleClinicalRequest(req);
    if (clinical) return clinical;
    // Health observation layer (energy/muscle/sleep/hydration) — trước astronauts để giữ thứ tự route.
    const health = await handleHealthRequest(req);
    if (health) return health;
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
