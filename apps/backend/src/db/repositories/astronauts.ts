import { eq } from "drizzle-orm";
import { db } from "../client";
import { astronauts } from "../schema/astronauts";

export const astronautsRepo = {
  async list() {
    return db.select().from(astronauts).all();
  },
  async get(id: string) {
    const rows = db.select().from(astronauts).where(eq(astronauts.id, id)).all();
    return rows[0] ?? null;
  },
  async seed() {
    const data = [
      { id: "ayla-reyes", name: "Ayla Reyes", roleCode: "CDR-01", callsign: "Ayla", bio: "Commander" },
      { id: "dae-jung-park", name: "Dae-Jung Park", roleCode: "FE-02", callsign: "Dae", bio: "Flight Engineer" },
      { id: "lena-fischer", name: "Lena Fischer", roleCode: "MO-03", callsign: "Lena", bio: "Medical Officer" },
      { id: "tomas-ortega", name: "Tomas Ortega", roleCode: "FE-04", callsign: "Tomas", bio: "Flight Engineer" },
      { id: "yuki-tanaka", name: "Yuki Tanaka", roleCode: "MS-05", callsign: "Yuki", bio: "Mission Specialist" },
      { id: "noor-abbasi", name: "Noor Abbasi", roleCode: "PA-06", callsign: "Noor", bio: "Payload Specialist" },
    ];
    for (const d of data) {
      const existing = await this.get(d.id);
      if (!existing) await db.insert(astronauts).values(d);
    }
  },
};