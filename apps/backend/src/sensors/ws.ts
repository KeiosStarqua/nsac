// WebSocket /ws/telemetry (SPEC §8.2) — Bun websocket handlers + subscription filter.
// KHÔNG auth (demo). Server frames: {type:"telemetry"|"sim_state", ...}; ping→pong.
// Per-connection filter theo deviceIds/missionId; bỏ trống = mọi event.

import { z } from "zod";
import { telemetryBus, simulationEngine } from "./engine";
import type { TelemetryEvent } from "./envelope";
import type { SimStatus } from "./engine";

export interface WsSubscription {
  /** null = không lọc theo device; Set rỗng không hợp lệ → chuẩn hoá về null khi subscribe. */
  deviceIds: Set<string> | null;
  missionId: string | null;
}
export interface WsData {
  subscription: WsSubscription;
}

// Structural typing — package apps/backend không có tsconfig, không import type từ "bun".
export interface TelemetrySocket {
  data: WsData;
  send(data: string): unknown;
}

const clients = new Set<TelemetrySocket>();

function matches(sub: WsSubscription, event: TelemetryEvent): boolean {
  if (sub.missionId && sub.missionId !== event.mission_id) return false;
  if (sub.deviceIds && !sub.deviceIds.has(event.device_id)) return false;
  return true;
}

function send(ws: TelemetrySocket, frame: unknown): void {
  try {
    ws.send(JSON.stringify(frame));
  } catch {
    // Client chết giữa chừng — bỏ qua, close handler sẽ dọn.
  }
}

/** Broadcast một telemetry event tới các connection khớp filter (SPEC §8.2). */
export function broadcastTelemetry(event: TelemetryEvent): void {
  for (const ws of clients) {
    if (matches(ws.data.subscription, event)) {
      send(ws, { type: "telemetry", event });
    }
  }
}

/** Gửi sim_state tới mọi connection (không lọc filter) — dùng khi stop/status mở. */
export function broadcastSimState(state: SimStatus): void {
  for (const ws of clients) {
    send(ws, { type: "sim_state", state });
  }
}

telemetryBus.on("telemetry", broadcastTelemetry);
telemetryBus.on("sim_state", broadcastSimState);

const subscribeSchema = z
  .object({
    type: z.literal("subscribe"),
    deviceIds: z.array(z.string().trim().min(1).max(64)).max(64).optional(),
    missionId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

const pingSchema = z.object({ type: z.literal("ping") }).strict();

export const wsHandlers = {
  data: {} as WsData,

  open(ws: TelemetrySocket): void {
    ws.data = { subscription: { deviceIds: null, missionId: null } };
    clients.add(ws);
    // Gửi sim_state ngay khi mở — client biết simulator đang ở đâu.
    send(ws, { type: "sim_state", state: simulationEngine.status() });
  },

  message(ws: TelemetrySocket, message: string | Buffer): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(message));
    } catch {
      return; // frame rác — bỏ qua, không đóng connection
    }
    const subscribe = subscribeSchema.safeParse(parsed);
    if (subscribe.success) {
      const ids = subscribe.data.deviceIds;
      ws.data.subscription = {
        deviceIds: ids && ids.length > 0 ? new Set(ids) : null,
        missionId: subscribe.data.missionId ?? null,
      };
      // Ack bằng sim_state (chỉ hai server→client frame types trong SPEC §8.2).
      send(ws, { type: "sim_state", state: simulationEngine.status() });
      return;
    }
    if (pingSchema.safeParse(parsed).success) {
      send(ws, { type: "pong" });
      return;
    }
    // Type lạ — bỏ qua theo SPEC (không có error frame).
  },

  close(ws: TelemetrySocket): void {
    clients.delete(ws);
  },
};
