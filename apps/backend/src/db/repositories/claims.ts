import { eq } from "drizzle-orm";
import { claimsDb as db } from "../claimsClient";
import { astronautClaims } from "../schema/astronautClaims";
import { astronauts } from "../schema/astronauts";

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

export const claimsRepo = {
  async list(sessionId?: string): Promise<ClaimEntry[]> {
    const rows = db.select().from(astronautClaims).all();
    return rows.map((row) => ({
      astronautId: row.astronautId,
      mine: sessionId !== undefined && row.sessionId === sessionId,
    }));
  },

  /**
   * Move semantics: one claim per session. Claiming another astronaut releases the previous
   * one. The whole check-then-write runs inside a single BEGIN IMMEDIATE transaction so two
   * sessions racing for the same crew member cannot both win.
   */
  claim(sessionId: string, astronautId: string): ClaimResult {
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
        // claim. Re-claiming the same astronaut is idempotent and just refreshes claimed_at.
        tx.delete(astronautClaims).where(eq(astronautClaims.sessionId, sessionId)).run();
        const now = Date.now();
        tx.insert(astronautClaims)
          .values({ astronautId, sessionId, claimedAt: now })
          .onConflictDoUpdate({
            target: astronautClaims.astronautId,
            set: { sessionId, claimedAt: now },
          })
          .run();
        return { status: "ok" as const };
      },
      { behavior: "immediate" },
    );
  },

  /** Xóa toàn bộ claims; trả về số dòng đã xóa. Chỉ dành cho demo/test (xem claimsRoutes). */
  reset(): number {
    const rows = db.select({ astronautId: astronautClaims.astronautId }).from(astronautClaims).all();
    db.delete(astronautClaims).run();
    return rows.length;
  },
};
