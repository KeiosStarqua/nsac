import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test này: đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào
// src/db/settingsClient.ts, để var/sky.db dùng chung không bao giờ bị đụng. Import động là bắt buộc.
const dir = mkdtempSync(join(tmpdir(), "sky-settings-test-"));
const dbPath = join(dir, "settings.db");

process.env.SKY_DB_PATH = dbPath;

type SettingsModule = typeof import("../src/settingsRoutes");

let handleSettingsRequest: SettingsModule["handleSettingsRequest"];

const get = () => handleSettingsRequest(new Request("http://test/api/settings/agent-model"));

const put = (model: unknown) =>
  handleSettingsRequest(
    new Request("http://test/api/settings/agent-model", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model }),
    }),
  );

beforeAll(async () => {
  const routes: SettingsModule = await import("../src/settingsRoutes");
  handleSettingsRequest = routes.handleSettingsRequest;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("agent-model setting", () => {
  test("GET on a fresh DB → { model: null, updatedAt: null }", async () => {
    const res = await get();
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ model: null, updatedAt: null });
  });

  test("PUT writes the setting", async () => {
    const res = await put("thinkingmachines/inkling-2-small:free");
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as { ok: boolean; model: string; updatedAt: number };
    expect(body.ok).toBe(true);
    expect(body.model).toBe("thinkingmachines/inkling-2-small:free");
    expect(typeof body.updatedAt).toBe("number");
  });

  test("GET returns the stored setting", async () => {
    const res = await get();
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as { model: string | null; updatedAt: number | null };
    expect(body.model).toBe("thinkingmachines/inkling-2-small:free");
    expect(typeof body.updatedAt).toBe("number");
  });

  test("PUT overwrites the previous value", async () => {
    const res = await put("openai/gpt-4o-mini");
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as { ok: boolean; model: string };
    expect(body.model).toBe("openai/gpt-4o-mini");
    const after = (await (await get())?.json()) as { model: string };
    expect(after.model).toBe("openai/gpt-4o-mini");
  });

  test("trimming is applied before validation", async () => {
    const res = await put("  anthropic/claude-haiku-4.5  ");
    expect(res?.status).toBe(200);
    expect(((await res?.json()) as { model: string }).model).toBe("anthropic/claude-haiku-4.5");
  });

  test("PUT rejects empty, garbage and whitespace-only values", async () => {
    for (const bad of ["", "   ", "has space inside", "UPPERCASE/Mod", "../../etc/passwd", "a".repeat(201), "model\nname", 123, null]) {
      const res = await put(bad);
      expect(res?.status).toBe(400);
    }
    // Giá trị cũ không bị hỏng bởi các lần PUT lỗi
    const after = (await (await get())?.json()) as { model: string };
    expect(after.model).toBe("anthropic/claude-haiku-4.5");
  });

  test("malformed JSON body → 400", async () => {
    const res = await handleSettingsRequest(
      new Request("http://test/api/settings/agent-model", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res?.status).toBe(400);
  });

  test("other methods/paths fall through (null)", async () => {
    const del = await handleSettingsRequest(new Request("http://test/api/settings/agent-model", { method: "DELETE" }));
    expect(del).toBeNull();
    const other = await handleSettingsRequest(new Request("http://test/api/settings/other"));
    expect(other).toBeNull();
  });
});
