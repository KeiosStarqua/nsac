import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng: đặt SKY_DB_PATH trước khi import module nào chạm tới settingsClient (cùng pattern
// với src/settingsHudBackground.test.ts), để var/sky.db dùng chung không bị đụng.
const dir = mkdtempSync(join(tmpdir(), "sky-settings-agent-core-test-"));
const dbPath = join(dir, "settings-agent-core.db");

process.env.SKY_DB_PATH = dbPath;

type SettingsModule = typeof import("./settingsRoutes");
type RepoModule = typeof import("./db/repositories/settings");

let handleSettingsRequest: SettingsModule["handleSettingsRequest"];
let writeRawRow: (value: string) => void;

const get = () => handleSettingsRequest(new Request("http://test/api/settings/agent-core"));

const put = (body: unknown) =>
  handleSettingsRequest(
    new Request("http://test/api/settings/agent-core", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  const routes: SettingsModule = await import("./settingsRoutes");
  handleSettingsRequest = routes.handleSettingsRequest;
  const repo: RepoModule = await import("./db/repositories/settings");
  // Ghi rác trực tiếp vào app_settings (giả lập hands-on DB edit) cho case fallback.
  writeRawRow = (value: string) => {
    const db = new Database(dbPath);
    try {
      db.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ).run(repo.AGENT_CORE_KEY, value, Date.now());
    } finally {
      db.close();
    }
  };
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("agent-core setting", () => {
  test("GET on a fresh DB → default pi, updatedAt null", async () => {
    const res = await get();
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ core: "pi", updatedAt: null });
  });

  test("PUT mastra → 200 + persisted value", async () => {
    const res = await put({ core: "mastra" });
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as { ok: boolean; core: string; updatedAt: number };
    expect(body.ok).toBe(true);
    expect(body.core).toBe("mastra");
    expect(typeof body.updatedAt).toBe("number");
  });

  test("GET after PUT reflects the stored core", async () => {
    const res = await get();
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as { core: string; updatedAt: number };
    expect(body.core).toBe("mastra");
    expect(typeof body.updatedAt).toBe("number");
  });

  test("PUT pi switches back → persisted", async () => {
    const res = await put({ core: "pi" });
    expect(res?.status).toBe(200);
    expect(((await res?.json()) as { core: string }).core).toBe("pi");
    const back = await get();
    expect(((await back?.json()) as { core: string }).core).toBe("pi");
  });

  test("PUT bogus value → 400 bad_core", async () => {
    for (const body of [{ core: "langgraph" }, { core: 42 }, {}, { core: "MASTRA" }, "not json"]) {
      const res = await put(body);
      expect(res?.status).toBe(400);
      expect(await res?.json()).toEqual({ ok: false, error: "bad_core" });
    }
  });

  test("garbage value in the DB → GET falls back to pi", async () => {
    writeRawRow("banana");
    const res = await get();
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ core: "pi", updatedAt: null });
  });
});
