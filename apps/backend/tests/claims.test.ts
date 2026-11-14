import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test này: đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào
// src/db/client.ts, để var/sky.db dùng chung không bao giờ bị đụng. Import động là bắt buộc.
const dir = mkdtempSync(join(tmpdir(), "sky-claims-test-"));
const dbPath = join(dir, "claims.db");

process.env.SKY_DB_PATH = dbPath;

// Tạo bảng astronauts (client.ts chỉ thêm astronaut_claims) và seed 6 rows trực tiếp —
// không qua astronautsRepo vì repo đó bind connection dùng chung (var/sky.db).
const seed = new Database(dbPath);
seed.exec(`
  CREATE TABLE astronauts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role_code TEXT NOT NULL,
    callsign TEXT,
    bio TEXT
  );
  INSERT INTO astronauts VALUES
    ('ayla-reyes', 'Ayla Reyes', 'CDR-01', 'Ayla', 'Commander'),
    ('dae-jung-park', 'Dae-Jung Park', 'FE-02', 'Dae', 'Flight Engineer'),
    ('lena-fischer', 'Lena Fischer', 'MO-03', 'Lena', 'Medical Officer'),
    ('tomas-ortega', 'Tomas Ortega', 'FE-04', 'Tomas', 'Flight Engineer'),
    ('yuki-tanaka', 'Yuki Tanaka', 'MS-05', 'Yuki', 'Mission Specialist'),
    ('noor-abbasi', 'Noor Abbasi', 'PA-06', 'Noor', 'Payload Specialist');
`);
seed.close();

type ClaimsModule = typeof import("../src/claimsRoutes");

let handleClaimsRequest: ClaimsModule["handleClaimsRequest"];

const claim = (sessionId: string, astronautId: string) =>
  handleClaimsRequest(
    new Request("http://test/api/claims", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, astronautId }),
    }),
  );

const list = (sessionId?: string) =>
  handleClaimsRequest(
    new Request(
      `http://test/api/claims${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`,
    ),
  );

const reset = () =>
  handleClaimsRequest(new Request("http://test/api/claims/reset", { method: "POST" }));

const SESSION_A = "session-aaaa-0001";
const SESSION_B = "session-bbbb-0002";

beforeAll(async () => {
  // Import động sau khi SKY_DB_PATH đã trỏ vào tmp file — mọi thứ claims chạm vào đều cô lập.
  const routes: ClaimsModule = await import("../src/claimsRoutes");
  handleClaimsRequest = routes.handleClaimsRequest;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("astronaut claims", () => {
  test("claim ok → 200", async () => {
    const res = await claim(SESSION_A, "ayla-reyes");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("second session claiming the same astronaut → 409", async () => {
    const res = await claim(SESSION_B, "ayla-reyes");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "taken" });
  });

  test("same session re-claiming → 200 idempotent", async () => {
    const res = await claim(SESSION_A, "ayla-reyes");
    expect(res.status).toBe(200);
  });

  test("GET lists claims with mine relative to the caller", async () => {
    const forA = (await (await list(SESSION_A)).json()) as Array<{ astronautId: string; mine: boolean }>;
    expect(forA).toEqual([{ astronautId: "ayla-reyes", mine: true }]);
    const forB = (await (await list(SESSION_B)).json()) as Array<{ astronautId: string; mine: boolean }>;
    expect(forB).toEqual([{ astronautId: "ayla-reyes", mine: false }]);
    // sessionId thiếu/sai định dạng → mine=false hết, vẫn 200
    const missing = (await (await list()).json()) as Array<{ astronautId: string; mine: boolean }>;
    expect(missing.every((c) => !c.mine)).toBe(true);
    expect(await (await list("short")).status).toBe(200);
  });

  test("claim A then claim B → A is free (move semantics)", async () => {
    expect((await claim(SESSION_A, "lena-fischer")).status).toBe(200);
    expect((await claim(SESSION_A, "tomas-ortega")).status).toBe(200);
    const forA = (await (await list(SESSION_A)).json()) as Array<{ astronautId: string; mine: boolean }>;
    expect(forA).toEqual([{ astronautId: "tomas-ortega", mine: true }]);
    // A đã được giải phóng: session khác claim được
    expect((await claim(SESSION_B, "lena-fischer")).status).toBe(200);
  });

  test("claiming a non-existent astronaut → 400", async () => {
    const res = await claim(SESSION_A, "nobody-here");
    expect(res.status).toBe(400);
    const res2 = await claim(SESSION_A, "");
    expect(res2.status).toBe(400);
  });

  test("malformed bodies → 400", async () => {
    const bad = await handleClaimsRequest(
      new Request("http://test/api/claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(bad?.status).toBe(400);
    const shortSession = await claim("tiny", "ayla-reyes");
    expect(shortSession.status).toBe(400);
  });

  test("reset clears every claim", async () => {
    const res = await reset();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; cleared: number };
    expect(body.ok).toBe(true);
    expect(body.cleared).toBeGreaterThanOrEqual(2);
    expect(await (await list()).json()).toEqual([]);
  });
});
