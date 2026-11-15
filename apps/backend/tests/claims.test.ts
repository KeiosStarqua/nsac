import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
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
type ClaimsRepoModule = typeof import("../src/db/repositories/claims");

let handleClaimsRequest: ClaimsModule["handleClaimsRequest"];
let claimTtlMs: ClaimsRepoModule["claimTtlMs"];

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

/** Body của GET /api/claims: `{ claims, epoch }` từ bản force-release. */
const listBody = async (sessionId?: string) =>
  (await (await list(sessionId)).json()) as {
    claims: Array<{ astronautId: string; mine: boolean }>;
    epoch: number;
  };

const reset = () =>
  handleClaimsRequest(new Request("http://test/api/claims/reset", { method: "POST" }));

const heartbeat = (sessionId: string) =>
  handleClaimsRequest(
    new Request("http://test/api/claims/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }),
  );

// Ghi trực tiếp DB test (connection thứ hai trên cùng file, WAL): mô phỏng claim đã idle 31 phút.
const expireRow = (astronautId: string, idleMs: number) => {
  const writer = new Database(dbPath);
  try {
    const idleStart = Date.now() - idleMs;
    writer
      .query(
        "UPDATE astronaut_claims SET claimed_at = ?1, last_seen_at = ?2 WHERE astronaut_id = ?3",
      )
      .run(idleStart, idleStart, astronautId);
  } finally {
    writer.close();
  }
};

const SESSION_A = "session-aaaa-0001";
const SESSION_B = "session-bbbb-0002";

beforeAll(async () => {
  // Import động sau khi SKY_DB_PATH đã trỏ vào tmp file — mọi thứ claims chạm vào đều cô lập.
  const routes: ClaimsModule = await import("../src/claimsRoutes");
  handleClaimsRequest = routes.handleClaimsRequest;
  const repo: ClaimsRepoModule = await import("../src/db/repositories/claims");
  claimTtlMs = repo.claimTtlMs;
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
    const forA = (await listBody(SESSION_A)).claims;
    expect(forA).toEqual([{ astronautId: "ayla-reyes", mine: true }]);
    const forB = (await listBody(SESSION_B)).claims;
    expect(forB).toEqual([{ astronautId: "ayla-reyes", mine: false }]);
    // sessionId thiếu/sai định dạng → mine=false hết, vẫn 200
    const missing = (await listBody()).claims;
    expect(missing.every((c) => !c.mine)).toBe(true);
    expect(await (await list("short")).status).toBe(200);
  });

  test("claim A then claim B → A is free (move semantics)", async () => {
    expect((await claim(SESSION_A, "lena-fischer")).status).toBe(200);
    expect((await claim(SESSION_A, "tomas-ortega")).status).toBe(200);
    const forA = (await listBody(SESSION_A)).claims;
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
    expect((await listBody()).claims).toEqual([]);
  });
});

describe("claim heartbeat", () => {
  test("heartbeat refreshes the claimant and is refused to other sessions", async () => {
    expect((await claim(SESSION_A, "ayla-reyes")).status).toBe(200);
    const mine = await heartbeat(SESSION_A);
    expect(mine.status).toBe(200);
    expect(await mine.json()).toEqual({ ok: true, refreshed: true });
    const other = await heartbeat(SESSION_B);
    expect(other.status).toBe(200);
    expect(await other.json()).toEqual({ ok: true, refreshed: false });
  });

  test("heartbeat with no claim → refreshed:false and creates no row", async () => {
    const res = await heartbeat("session-cccc-0003");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, refreshed: false });
    // Không có row nào cho session chưa claim ai (danh sách vẫn chỉ có claim của A).
    const rows = (await listBody()).claims;
    expect(rows.map((row) => row.astronautId)).toEqual(["ayla-reyes"]);
  });

  test("heartbeat rejects a malformed body", async () => {
    const bad = await handleClaimsRequest(
      new Request("http://test/api/claims/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: "tiny" }),
      }),
    );
    expect(bad?.status).toBe(400);
    expect(await bad?.json()).toEqual({ ok: false, error: "bad_body" });
    const notJson = await handleClaimsRequest(
      new Request("http://test/api/claims/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(notJson?.status).toBe(400);
    // GET không thuộc route này → fall-through (server.ts trả 404).
    const get = await handleClaimsRequest(
      new Request("http://test/api/claims/heartbeat?sessionId=session-aaaa-0001"),
    );
    expect(get).toBeNull();
  });
});

describe("claim TTL", () => {
  test("TTL env parsing is lenient (bad values → 30 min)", () => {
    expect(claimTtlMs(undefined)).toBe(30 * 60_000);
    expect(claimTtlMs("")).toBe(30 * 60_000);
    expect(claimTtlMs("abc")).toBe(30 * 60_000);
    expect(claimTtlMs("0")).toBe(30 * 60_000);
    expect(claimTtlMs("-5")).toBe(30 * 60_000);
    expect(claimTtlMs("10")).toBe(10 * 60_000);
  });

  test("stale claim is released lazily on list(), then claimable by another session", async () => {
    expect((await claim(SESSION_A, "ayla-reyes")).status).toBe(200);
    expireRow("ayla-reyes", 31 * 60_000);
    expect((await listBody()).claims).toEqual([]);
    expect((await claim(SESSION_B, "ayla-reyes")).status).toBe(200);
  });

  test("stale claim does not block claim(): the expired holder is swept first", async () => {
    expect((await claim(SESSION_A, "lena-fischer")).status).toBe(200);
    expireRow("lena-fischer", 31 * 60_000);
    // A (holder cũ) đã hết hạn → B claim thẳng, không cần list() trước.
    expect((await claim(SESSION_B, "lena-fischer")).status).toBe(200);
    expect((await claim(SESSION_A, "lena-fischer")).status).toBe(409);
  });

  test("a claim inside the TTL window is kept", async () => {
    expect((await claim(SESSION_A, "tomas-ortega")).status).toBe(200);
    expireRow("tomas-ortega", 29 * 60_000);
    expect((await claim(SESSION_B, "tomas-ortega")).status).toBe(409);
    const rows = (await listBody(SESSION_A)).claims;
    expect(rows).toEqual(
      expect.arrayContaining([{ astronautId: "tomas-ortega", mine: true }]),
    );
  });
});

// Force-release epoch: ghi/xóa row `claims.reset.epoch` trực tiếp (connection thứ hai cùng file).
const seedEpoch = (value: string) => {
  const writer = new Database(dbPath);
  try {
    writer
      .query(
        "INSERT INTO app_settings (key, value, updated_at) VALUES ('claims.reset.epoch', ?1, ?2) " +
          "ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2",
      )
      .run(value, Date.now());
  } finally {
    writer.close();
  }
};

const clearEpoch = () => {
  const writer = new Database(dbPath);
  try {
    writer.query("DELETE FROM app_settings WHERE key = 'claims.reset.epoch'").run();
  } finally {
    writer.close();
  }
};

describe("claims reset epoch", () => {
  beforeEach(() => {
    clearEpoch();
  });

  test("each reset bumps the epoch by one", async () => {
    expect((await claim(SESSION_A, "ayla-reyes")).status).toBe(200);
    const first = (await (await reset()).json()) as { ok: boolean; cleared: number; epoch: number };
    expect(first.ok).toBe(true);
    expect(first.cleared).toBeGreaterThanOrEqual(1);
    expect(first.epoch).toBe(1);
    const second = (await (await reset()).json()) as { cleared: number; epoch: number };
    expect(second.cleared).toBe(0);
    expect(second.epoch).toBe(first.epoch + 1);
  });

  test("GET /api/claims exposes the bumped epoch and an empty list after a reset", async () => {
    expect((await claim(SESSION_A, "lena-fischer")).status).toBe(200);
    const bumped = (await (await reset()).json()) as { epoch: number };
    const body = await listBody(SESSION_A);
    expect(body.claims).toEqual([]);
    expect(body.epoch).toBe(bumped.epoch);
  });

  test("a garbage epoch in app_settings reads as 0 and the next bump is 1", async () => {
    seedEpoch("banana");
    const { settingsRepo } = await import("../src/db/repositories/settings");
    expect(settingsRepo.getClaimsResetEpoch()).toBe(0);
    expect(settingsRepo.bumpClaimsResetEpoch()).toBe(1);
    expect(settingsRepo.getClaimsResetEpoch()).toBe(1);
  });
});

