import { eq } from "drizzle-orm";
import { db } from "../client";
import { readings } from "../schema";

export const readingsRepo = {
  async insert(row: typeof readings.$inferInsert) {
    const [r] = await db.insert(readings).values(row).returning();
    return r;
  },
  async list(limit = 100) {
    return db.select().from(readings).limit(limit);
  },
  async byAstronaut(id: string) {
    return db.select().from(readings).where(eq(readings.astronautId, id));
  },
};