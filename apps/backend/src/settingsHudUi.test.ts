import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng: đặt SKY_DB_PATH trước khi import module nào chạm tới settingsClient (cùng pattern
// với tests/settings-agent-models.test.ts), để var/sky.db dùng chung không bị đụng.
const dir = mkdtempSync(join(tmpdir(), "sky-settings-hud-ui-test-"));
const dbPath = join(dir, "settings-hud-ui.db");

process.env.SKY_DB_PATH = dbPath;

type SettingsModule = typeof import("./settingsRoutes");
type RepoModule = typeof import("./db/repositories/settings");

let handleSettingsRequest: SettingsModule["handleSettingsRequest"];
let writeRawRow: (value: string) => void;

const get = () => handleSettingsRequest(new Request("http://test/api/settings/hud-ui"));

const put = (body: unknown) =>
  handleSettingsRequest(
    new Request("http://test/api/settings/hud-ui", {
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
      ).run(repo.HUD_UI_KEY, value, Date.now());
    } finally {
      db.close();
    }
  };
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("hud-ui setting", () => {
  test("GET on a fresh DB → default mock, updatedAt null", async () => {
    const res = await get();
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ ui: "mock", updatedAt: null });
  });

  test("PUT gen → 200 + persisted value", async () => {
    const res = await put({ ui: "gen" });
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as { ok: boolean; ui: string; updatedAt: number };
    expect(body.ok).toBe(true);
    expect(body.ui).toBe("gen");
    expect(typeof body.updatedAt).toBe("number");
  });

  test("GET after PUT reflects the stored value", async () => {
    const res = await get();
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as { ui: string; updatedAt: number };
    expect(body.ui).toBe("gen");
    expect(typeof body.updatedAt).toBe("number");
  });

  test("PUT bogus value → 400 bad_hud_ui", async () => {
    for (const body of [{ ui: "openui" }, { ui: 42 }, {}, "not json"]) {
      const res = await put(body);
      expect(res?.status).toBe(400);
      expect(await res?.json()).toEqual({ ok: false, error: "bad_hud_ui" });
    }
  });

  test("garbage value in the DB → GET falls back to mock", async () => {
    writeRawRow("banana");
    const res = await get();
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ ui: "mock", updatedAt: null });
  });
});
