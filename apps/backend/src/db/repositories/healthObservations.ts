import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { healthObservations } from "../schema";

// Health observation layer dùng chung connection `db` (client.ts) như readingsRepo — một writer
// là đủ cho WAL; không mở connection thứ ba.

export type HealthObservationInsert = typeof healthObservations.$inferInsert;
export type HealthObservationRow = typeof healthObservations.$inferSelect;

const MAX_ROWS = 500;

export const healthObservationsRepo = {
  /** Rows thô mới nhất trước (ts DESC, id DESC) — dùng cho GET /api/health/observations. */
  async list({ astronautId, metric, limit = MAX_ROWS }: { astronautId?: string; metric?: string; limit?: number } = {}) {
    const capped = Math.min(MAX_ROWS, Math.max(1, Math.trunc(limit)));
    const conditions = [];
    if (astronautId) conditions.push(eq(healthObservations.astronautId, astronautId));
    if (metric) conditions.push(eq(healthObservations.metric, metric));
    const base =
      conditions.length > 0
        ? db.select().from(healthObservations).where(and(...conditions))
        : db.select().from(healthObservations);
    return base
      .orderBy(desc(healthObservations.ts), desc(healthObservations.id))
      .limit(capped)
      .all();
  },

  /** `limit` row gần nhất của một series, trả về TĂNG dần theo ts (chart đọc trái→phải). */
  async byAstronautMetric(astronautId: string, metric: string, limit = 30) {
    const capped = Math.min(MAX_ROWS, Math.max(1, Math.trunc(limit)));
    const rows = db
      .select()
      .from(healthObservations)
      .where(and(eq(healthObservations.astronautId, astronautId), eq(healthObservations.metric, metric)))
      .orderBy(desc(healthObservations.ts), desc(healthObservations.id))
      .limit(capped)
      .all();
    return rows.reverse();
  },

  /** Row mới nhất của mỗi metric cho một astronaut (map lấy row cuối theo ts tăng dần). */
  async latestByMetric(astronautId: string) {
    const rows = db
      .select()
      .from(healthObservations)
      .where(eq(healthObservations.astronautId, astronautId))
      .orderBy(asc(healthObservations.ts), asc(healthObservations.id))
      .all();
    const latest = new Map<string, HealthObservationRow>();
    for (const row of rows) latest.set(row.metric, row);
    return Array.from(latest.values());
  },

  /** Ghi cả batch trong một transaction — seed gọi một lần cho mỗi (astronaut, metric). */
  insertMany(rows: HealthObservationInsert[]): void {
    if (rows.length === 0) return;
    db.transaction((tx) => {
      for (const row of rows) tx.insert(healthObservations).values(row).run();
    });
  },

  /** Số row của một series — dùng cho seed idempotency (0 = chưa seed). Sync như telemetryRepo.maxSequence. */
  countByMetric(astronautId: string, metric: string): number {
    const rows = db
      .select({ n: sql<number>`count(*)` })
      .from(healthObservations)
      .where(and(eq(healthObservations.astronautId, astronautId), eq(healthObservations.metric, metric)))
      .all();
    return rows[0]?.n ?? 0;
  },
};
