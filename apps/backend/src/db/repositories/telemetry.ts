import { and, desc, eq, sql } from "drizzle-orm";
import { sensorsDb } from "../sensorsClient";
import { telemetryEvents } from "../schema/telemetryEvents";

export interface TelemetryEventInsert {
  eventId: string;
  missionId: string;
  crewId: string | null;
  deviceId: string;
  deviceType: string;
  locationId: string | null;
  sourceMode: "synthetic" | "replay" | "real";
  datasetId: string | null;
  observedAt: string;
  receivedAt: string;
  sequence: number;
  qualityStatus: "good" | "suspect" | "invalid";
  payload: string;
}

export const telemetryRepo = {
  /** Insert cả batch trong một transaction — engine gọi mỗi tick (SENSOR_SIMULATION_SPEC §6.4). */
  insertBatch(events: TelemetryEventInsert[]) {
    if (events.length === 0) return;
    sensorsDb.transaction((tx) => {
      for (const ev of events) {
        tx.insert(telemetryEvents).values(ev).run();
      }
    });
  },

  /** ORDER BY observed_at DESC, LIMIT ≤ 500 (SENSOR_SIMULATION_SPEC §7/§8.1). */
  recent({ deviceId, missionId, limit = 50 }: { deviceId?: string; missionId?: string; limit?: number }) {
    const capped = Math.min(500, Math.max(1, Math.trunc(limit)));
    const conditions = [];
    if (deviceId) conditions.push(eq(telemetryEvents.deviceId, deviceId));
    if (missionId) conditions.push(eq(telemetryEvents.missionId, missionId));
    const query = sensorsDb.select().from(telemetryEvents);
    const filtered = conditions.length > 0 ? query.where(and(...conditions)) : query;
    return filtered.orderBy(desc(telemetryEvents.observedAt)).limit(capped).all();
  },

  maxSequence(missionId: string, deviceId: string): number {
    const rows = sensorsDb
      .select({ max: sql<number | null>`max(${telemetryEvents.sequence})` })
      .from(telemetryEvents)
      .where(and(eq(telemetryEvents.missionId, missionId), eq(telemetryEvents.deviceId, deviceId)))
      .all();
    return rows[0]?.max ?? 0;
  },

  /** Demo helper cho sim/reset — xoá events của một mission, trả về số dòng đã xoá. */
  deleteByMission(missionId: string): number {
    // bun-sqlite .run() không trả về changes — đếm trước rồi xoá (demo helper, không cần atomic).
    const rows = sensorsDb
      .select({ n: sql<number>`count(*)` })
      .from(telemetryEvents)
      .where(eq(telemetryEvents.missionId, missionId))
      .all();
    const n = rows[0]?.n ?? 0;
    sensorsDb.delete(telemetryEvents).where(eq(telemetryEvents.missionId, missionId)).run();
    return n;
  },
};
