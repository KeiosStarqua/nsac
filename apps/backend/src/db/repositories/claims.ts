import { eq, inArray, sql } from "drizzle-orm";
import { claimsDb as db } from "../claimsClient";
import { astronautClaims } from "../schema/astronautClaims";
import { astronauts } from "../schema/astronauts";
import { settingsRepo } from "./settings";

export type ClaimResult =
  | { status: "ok" }
  /** Another session is holding this astronaut. */
  | { status: "taken" }
  /** astronautId does not exist in the roster. */
  | { status: "not_found" };

/** `mine` is only true for rows held by `sessionId`; other sessionIds never leave the server. */
export interface ClaimEntry {
  astronautId: string;
  mine: boolean;
}

/** TTL mặc định: 30 phút không heartbeat thì claim bị giải phóng (yêu cầu 2026-11-15). */
export const DEFAULT_CLAIM_TTL_MINUTES = 30;

/**
 * TTL claim tính bằng ms, pure để test được mà không cần reload module: env sai/không dương
 * (rỗng, "abc", "0", "-5") → 30 phút. Mặc định đọc `SKY_CLAIM_TTL_MINUTES` mỗi lần gọi nên test
 * (và deploy) override được ngay, không phải import lại.
 */
export function claimTtlMs(envVal: string | undefined = process.env.SKY_CLAIM_TTL_MINUTES): number {
  const minutes = Number.parseInt(envVal ?? "", 10);
  const effective = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_CLAIM_TTL_MINUTES;
  return effective * 60_000;
}

/**
 * `last_seen_at` = 0 nghĩa là row cũ chưa từng heartbeat (backfill chạy lúc mở DB, nhưng giữ
 * fallback này để claim tạo trước một bản build cũ không sống mãi).
 */
function staleBefore(cutoff: number) {
  return sql`coalesce(nullif(${astronautClaims.lastSeenAt}, 0), ${astronautClaims.claimedAt}) < ${cutoff}`;
}

export const claimsRepo = {
  /**
   * Giải phóng claim idle: xóa mọi row mà lần hoạt động cuối (heartbeat, hoặc claimed_at nếu
   * chưa có heartbeat) cũ hơn TTL. Trả về số row đã xóa. Gọi ở list()/claim()/heartbeat() nên
   * claim hết hạn được thu hồi lười ngay cả khi sweep định kỳ trong server.ts không chạy.
   */
  sweepStale(now = Date.now()): number {
    const cutoff = now - claimTtlMs();
    const stale = db
      .select({ astronautId: astronautClaims.astronautId })
      .from(astronautClaims)
      .where(staleBefore(cutoff))
      .all();
    if (stale.length === 0) return 0;
    db.delete(astronautClaims)
      .where(
        inArray(
          astronautClaims.astronautId,
          stale.map((row) => row.astronautId),
        ),
      )
      .run();
    return stale.length;
  },

  async list(sessionId?: string): Promise<ClaimEntry[]> {
    claimsRepo.sweepStale();
    const rows = db.select().from(astronautClaims).all();
    return rows.map((row) => ({
      astronautId: row.astronautId,
      mine: sessionId !== undefined && row.sessionId === sessionId,
    }));
  },

  /**
   * Move semantics: one claim per session. Claiming another astronaut releases the previous
   * one. The whole check-then-write runs inside a single BEGIN IMMEDIATE transaction so two
   * sessions racing for the same crew member cannot both win. Stale claims are swept before the
   * transaction so an expired holder never blocks the claim.
   */
  claim(sessionId: string, astronautId: string): ClaimResult {
    claimsRepo.sweepStale();
    return db.transaction(
      (tx) => {
        const exists = tx
          .select({ id: astronauts.id })
          .from(astronauts)
          .where(eq(astronauts.id, astronautId))
          .all();
        if (exists.length === 0) return { status: "not_found" as const };

        const holder = tx
          .select({ sessionId: astronautClaims.sessionId })
          .from(astronautClaims)
          .where(eq(astronautClaims.astronautId, astronautId))
          .all()[0];
        if (holder && holder.sessionId !== sessionId) {
          return { status: "taken" as const };
        }

        // Release whatever this session held before (move semantics), then upsert the new
        // claim. Re-claiming the same astronaut is idempotent and just refreshes the timestamps.
        tx.delete(astronautClaims).where(eq(astronautClaims.sessionId, sessionId)).run();
        const now = Date.now();
        tx.insert(astronautClaims)
          .values({ astronautId, sessionId, claimedAt: now, lastSeenAt: now })
          .onConflictDoUpdate({
            target: astronautClaims.astronautId,
            set: { sessionId, claimedAt: now, lastSeenAt: now },
          })
          .run();
        return { status: "ok" as const };
      },
      { behavior: "immediate" },
    );
  },

  /**
   * Làm mới `last_seen_at` cho claim của session này. KHÔNG BAO GIỜ tạo claim mới: session không
   * giữ ai → `refreshed: false` và không có row nào được ghi.
   */
  heartbeat(sessionId: string): { refreshed: boolean } {
    claimsRepo.sweepStale();
    const held = db
      .select({ astronautId: astronautClaims.astronautId })
      .from(astronautClaims)
      .where(eq(astronautClaims.sessionId, sessionId))
      .all();
    if (held.length === 0) return { refreshed: false };
    db.update(astronautClaims)
      .set({ lastSeenAt: Date.now() })
      .where(eq(astronautClaims.sessionId, sessionId))
      .run();
    return { refreshed: true };
  },

  /**
   * Xóa toàn bộ claims và bump epoch reset; chỉ dành cho demo/test (xem claimsRoutes). Epoch là
   * phần làm reset có hiệu lực thật: tab đang mở thấy epoch lệch sẽ tự bỏ pick của mình.
   */
  reset(): { cleared: number; epoch: number } {
    const rows = db.select({ astronautId: astronautClaims.astronautId }).from(astronautClaims).all();
    db.delete(astronautClaims).run();
    const epoch = settingsRepo.bumpClaimsResetEpoch();
    return { cleared: rows.length, epoch };
  },
};
