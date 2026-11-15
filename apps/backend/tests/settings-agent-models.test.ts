import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test này: đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào
// src/db/settingsClient.ts, để var/sky.db dùng chung không bao giờ bị đụng. Import động là bắt buộc.
const dir = mkdtempSync(join(tmpdir(), "sky-settings-models-test-"));
const dbPath = join(dir, "settings-models.db");

process.env.SKY_DB_PATH = dbPath;

type SettingsModule = typeof import("../src/settingsRoutes");

let handleSettingsRequest: SettingsModule["handleSettingsRequest"];

const get = () => handleSettingsRequest(new Request("http://test/api/settings/agent-models"));

const put = (body: unknown) =>
  handleSettingsRequest(
    new Request("http://test/api/settings/agent-models", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  const routes: SettingsModule = await import("../src/settingsRoutes");
  handleSettingsRequest = routes.handleSettingsRequest;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("agent-models setting", () => {
  test("GET on a fresh DB → provider/model/models/updatedAt all null", async () => {
    const res = await get();
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ provider: null, model: null, models: null, updatedAt: null });
  });

  test("PUT roundtrip provider + model + models", async () => {
    const res = await put({
      provider: "opencode-go",
      model: "deepseek-v4.1-flash",
      models: { "sky-chat": "glm-5.3-flash", "sky-hud-composer": "deepseek-v4-pro" },
    });
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as {
      ok: boolean;
      provider: string | null;
      model: string | null;
      models: Record<string, string> | null;
      updatedAt: number | null;
    };
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("opencode-go");
    expect(body.model).toBe("deepseek-v4.1-flash");
    expect(body.models).toEqual({ "sky-chat": "glm-5.3-flash", "sky-hud-composer": "deepseek-v4-pro" });
    expect(typeof body.updatedAt).toBe("number");

    const after = (await (await get())?.json()) as typeof body;
    expect(after.provider).toBe("opencode-go");
    expect(after.model).toBe("deepseek-v4.1-flash");
    expect(after.models).toEqual({ "sky-chat": "glm-5.3-flash", "sky-hud-composer": "deepseek-v4-pro" });
    expect(typeof after.updatedAt).toBe("number");
  });

  test("PUT with partial fields leaves the others untouched", async () => {
    const res = await put({ models: { "sky-orchestrator": "qwen3.8-flash" } });
    expect(res?.status).toBe(200);
    const after = (await (await get())?.json()) as {
      provider: string | null;
      model: string | null;
      models: Record<string, string> | null;
    };
    expect(after.provider).toBe("opencode-go");
    expect(after.model).toBe("deepseek-v4.1-flash");
    expect(after.models).toEqual({ "sky-orchestrator": "qwen3.8-flash" });
  });

  test("PUT null deletes the corresponding keys", async () => {
    const res = await put({ provider: null, model: null, models: null });
    expect(res?.status).toBe(200);
    const after = (await (await get())?.json()) as {
      provider: string | null;
      model: string | null;
      models: Record<string, string> | null;
      updatedAt: number | null;
    };
    expect(after).toEqual({ provider: null, model: null, models: null, updatedAt: null });
  });

  test("PUT models {} deletes the key", async () => {
    await put({ models: { "sky-chat": "deepseek-v4.1-flash" } });
    const res = await put({ models: {} });
    expect(res?.status).toBe(200);
    const after = (await (await get())?.json()) as { models: unknown };
    expect(after.models).toBeNull();
  });

  test("rejects an unknown provider", async () => {
    for (const bad of ["anthropic", "OpenRouter", "opencode_go", "", 123, null].slice(0, 5)) {
      const res = await put({ provider: bad });
      // null is the delete sentinel and must stay valid.
      expect(res?.status).toBe(400);
    }
  });

  test("rejects garbage model ids and profile keys", async () => {
    for (const bad of ["UPPER CASE", "has space", "", "../escape", "a".repeat(201), "model\nname"]) {
      expect((await put({ model: bad }))?.status).toBe(400);
      expect((await put({ models: { "sky-chat": bad } }))?.status).toBe(400);
    }
    expect((await put({ models: { "Bad Key": "deepseek-v4.1-flash" } }))?.status).toBe(400);
    expect((await put({ models: { "_leading": "deepseek-v4.1-flash" } }))?.status).toBe(400);
    expect((await put({ models: { ["a".repeat(65)]: "deepseek-v4.1-flash" } }))?.status).toBe(400);
    expect((await put({ models: [] as unknown as Record<string, string> }))?.status).toBe(400);
  });

  test("rejects more than 16 entries", async () => {
    const models: Record<string, string> = {};
    for (let i = 0; i < 17; i += 1) models[`profile-${i}`] = "deepseek-v4.1-flash";
    const res = await put({ models });
    expect(res?.status).toBe(400);
    expect(((await res?.json()) as { error: string }).error).toBe("bad_models");
  });

  test("malformed JSON body → 400", async () => {
    const res = await handleSettingsRequest(
      new Request("http://test/api/settings/agent-models", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res?.status).toBe(400);
  });

  test("legacy /api/settings/agent-model behaves as before", async () => {
    const res = await handleSettingsRequest(
      new Request("http://test/api/settings/agent-model", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "openai/gpt-4o-mini" }),
      }),
    );
    expect(res?.status).toBe(200);
    const legacyGet = await handleSettingsRequest(new Request("http://test/api/settings/agent-model"));
    expect(((await legacyGet?.json()) as { model: string | null }).model).toBe("openai/gpt-4o-mini");
    // legacy key is visible via the new GET too (raw), while updatedAt reflects only the 2 new keys
    const snap = (await (await get())?.json()) as { model: string | null; updatedAt: number | null };
    expect(snap.model).toBe("openai/gpt-4o-mini");
  });

  test("other methods/paths fall through (null)", async () => {
    const del = await handleSettingsRequest(new Request("http://test/api/settings/agent-models", { method: "DELETE" }));
    expect(del).toBeNull();
    const other = await handleSettingsRequest(new Request("http://test/api/settings/other"));
    expect(other).toBeNull();
  });
});
