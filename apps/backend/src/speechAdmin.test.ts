import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test: đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào src/db/*.
// Import động là bắt buộc (giống speech-engine.test.ts) — bun test chia sẻ module cache trong một process.
// Port WS riêng để không đụng 3300 (mặc định production) hay các file test khác.
const dir = mkdtempSync(join(tmpdir(), "sky-speech-admin-test-"));
const dbPath = join(dir, "speech-admin.db");

process.env.SKY_DB_PATH = dbPath;
process.env.SPEECH_WS_PORT = "3391";
const TEST_API_KEY = `sk_${"d".repeat(48)}`;
process.env.ELEVENLABS_API_KEY = TEST_API_KEY;
delete process.env.ELEVENLABS_SPEECH_ENGINE_ID;

type SpeechAdminModule = typeof import("./speechAdmin");
type SpeechModule = typeof import("./speechEngine");
type SettingsModule = typeof import("./db/repositories/settings");

let speechAdmin: SpeechAdminModule;
let speech: SpeechModule;
let settingsRepo: SettingsModule["settingsRepo"];

const req = (path: string, init?: RequestInit) =>
  new Request(`http://test${path}`, init);

const postJson = (path: string, body: unknown) =>
  req(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** fetchImpl stub — ghi lại call cuối, trả về response cố định. Không bao giờ chạm mạng. */
function stubFetch(res: () => Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return res();
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeAll(async () => {
  speechAdmin = await import("./speechAdmin");
  speech = await import("./speechEngine");
  const s: SettingsModule = await import("./db/repositories/settings");
  settingsRepo = s.settingsRepo;
});

beforeEach(() => {
  speech.stopSpeechEngine();
  settingsRepo.clearSpeechEngineId();
  delete process.env.ELEVENLABS_SPEECH_ENGINE_ID;
});

afterEach(() => {
  speech.stopSpeechEngine();
  settingsRepo.clearSpeechEngineId();
  delete process.env.ELEVENLABS_SPEECH_ENGINE_ID;
});

afterAll(() => {
  speech.stopSpeechEngine();
  rmSync(dir, { recursive: true, force: true });
});

describe("settingsRepo speech_engine.id roundtrip", () => {
  test("absent → null; set → read back; clear → null; re-set overwrites", () => {
    expect(settingsRepo.getSpeechEngineId()).toBeNull();
    settingsRepo.setSpeechEngineId("eng_abc123");
    expect(settingsRepo.getSpeechEngineId()?.engineId).toBe("eng_abc123");
    expect(settingsRepo.clearSpeechEngineId()).toBe(true);
    expect(settingsRepo.getSpeechEngineId()).toBeNull();
    expect(settingsRepo.clearSpeechEngineId()).toBe(false);
    settingsRepo.setSpeechEngineId("eng_one");
    settingsRepo.setSpeechEngineId("eng_two");
    expect(settingsRepo.getSpeechEngineId()?.engineId).toBe("eng_two");
    settingsRepo.clearSpeechEngineId();
  });
});

describe("GET /api/settings/speech-engine", () => {
  const get = () => speechAdmin.handleSpeechAdminRequest(req("/api/settings/speech-engine"));

  test("no env, no db → not configured, no id, source null", async () => {
    const res = await get();
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({
      ok: true,
      configured: false,
      engineId: null,
      source: null,
      wsRunning: false,
      port: 3391,
      lastError: null,
      apiKeyConfigured: true,
      envOverridesDb: false,
    });
  });

  test("db only → source db, id shown, still not configured (WS not running)", async () => {
    settingsRepo.setSpeechEngineId("eng_db_only");
    const res = await get();
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, configured: false, engineId: "eng_db_only", source: "db", wsRunning: false, envOverridesDb: false, apiKeyConfigured: true });
  });

  test("env only → source env", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "eng_env_only";
    const res = await get();
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, configured: false, engineId: "eng_env_only", source: "env", wsRunning: false, envOverridesDb: false });
  });

  test("env + db → env wins and envOverridesDb flags the shadowed db row", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "eng_env_wins";
    settingsRepo.setSpeechEngineId("eng_db_shadowed");
    const res = await get();
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, engineId: "eng_env_wins", source: "env", envOverridesDb: true });
  });

  test("non-GET method falls through (null), wrong path falls through (null)", async () => {
    expect(await speechAdmin.handleSpeechAdminRequest(req("/api/settings/speech-engine", { method: "POST" }))).toBeNull();
    expect(await speechAdmin.handleSpeechAdminRequest(req("/api/settings/other"))).toBeNull();
  });
});

describe("POST /probe", () => {
  const probe = (fetchImpl?: typeof fetch) =>
    speechAdmin.handleSpeechAdminRequest(postJson("/api/settings/speech-engine/probe", {}), fetchImpl);

  test("401 upstream → { ok: false, httpStatus: 401, message } without leaking anything", async () => {
    const { fn, calls } = stubFetch(() => jsonRes({ detail: { message: "missing convai_read permission" } }, 401));
    const res = await probe(fn);
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(body.httpStatus).toBe(401);
    expect(body.message).toBe("missing convai_read permission");
    expect(JSON.stringify(body)).not.toContain(TEST_API_KEY);
    // Calls the list endpoint with the key header.
    expect(calls[0]?.url).toContain("/v1/speech-engine?page_size=1");
    expect((calls[0]?.init?.headers as Record<string, string>)["xi-api-key"]).toBe(TEST_API_KEY);
  });

  test("non-JSON upstream error body → graceful message", async () => {
    const { fn } = stubFetch(() => new Response("<html>bad gateway</html>", { status: 502 }));
    const res = await probe(fn);
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: false, httpStatus: 502 });
    expect(typeof body.message).toBe("string");
  });

  test("upstream 200 → { ok: true, httpStatus: 200 }", async () => {
    const { fn } = stubFetch(() => jsonRes({ speech_engines: [] }, 200));
    const res = await probe(fn);
    expect(await res?.json()).toEqual({ ok: true, httpStatus: 200 });
  });
});

describe("POST /create", () => {
  const create = (body: unknown, fetchImpl?: typeof fetch) =>
    speechAdmin.handleSpeechAdminRequest(postJson("/api/settings/speech-engine/create", body), fetchImpl);

  test("success stores the id in the DB and flips wsRunning true (env unset → effective source db)", async () => {
    const { fn, calls } = stubFetch(() => jsonRes({ speech_engine_id: "eng_created_1" }, 200));
    const res = await create({}, fn);
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, engineId: "eng_created_1", wsUrl: "wss://nasa.taquangkhoi.com/speech/ws", wsRunning: true });
    expect(settingsRepo.getSpeechEngineId()?.engineId).toBe("eng_created_1");
    const status = (await (await speechAdmin.handleSpeechAdminRequest(req("/api/settings/speech-engine")))?.json()) as Record<string, unknown>;
    expect(status).toMatchObject({ wsRunning: true, engineId: "eng_created_1", source: "db", configured: true });
    // The upstream call carried the default name + wsUrl and the key header.
    const sent = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(sent).toEqual({ name: "sky-nsac-speech-engine", speechEngine: { wsUrl: "wss://nasa.taquangkhoi.com/speech/ws" } });
    speech.stopSpeechEngine();
  });

  test("accepts the `id` fallback key in the upstream response", async () => {
    const { fn } = stubFetch(() => jsonRes({ id: "eng_from_id_key" }, 200));
    const res = await create({ name: "custom-name", wsUrl: "wss://example.com/ws" }, fn);
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, engineId: "eng_from_id_key", wsUrl: "wss://example.com/ws" });
    expect(settingsRepo.getSpeechEngineId()?.engineId).toBe("eng_from_id_key");
    speech.stopSpeechEngine();
  });

  test("bad wsUrl (not a URL) → 400, no upstream call", async () => {
    const { fn, calls } = stubFetch(() => jsonRes({}, 200));
    const res = await create({ wsUrl: "not a url" }, fn);
    expect(res?.status).toBe(400);
    expect(((await res?.json()) as { error: string }).error).toBe("bad_ws_url");
    expect(calls.length).toBe(0);
  });

  test("non-wss wsUrl → 400, no upstream call", async () => {
    const { fn, calls } = stubFetch(() => jsonRes({}, 200));
    for (const wsUrl of ["http://example.com/ws", "https://example.com/ws", "ws://example.com/ws"]) {
      const res = await create({ wsUrl }, fn);
      expect(res?.status).toBe(400);
    }
    expect(calls.length).toBe(0);
  });

  test("upstream 422 → forwards httpStatus + message, stores nothing", async () => {
    const { fn } = stubFetch(() => jsonRes({ detail: { message: "wsUrl unreachable" } }, 422));
    const res = await create({}, fn);
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: false, httpStatus: 422, message: "wsUrl unreachable" });
    expect(settingsRepo.getSpeechEngineId()).toBeNull();
  });

  test("unreadable id in upstream 200 → ok:false, stores nothing", async () => {
    const { fn } = stubFetch(() => jsonRes({ something_else: true }, 200));
    const res = await create({}, fn);
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(String(body.message)).toContain("unreadable");
    expect(settingsRepo.getSpeechEngineId()).toBeNull();
  });

  test("env id set → create still stores DB id but flags envShadowing (effective stays env)", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "eng_env_shadowing";
    const { fn } = stubFetch(() => jsonRes({ speech_engine_id: "eng_db_new" }, 200));
    const res = await create({}, fn);
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, engineId: "eng_db_new", envShadowing: true });
    expect(settingsRepo.getSpeechEngineId()?.engineId).toBe("eng_db_new");
    speech.stopSpeechEngine();
  });
});

describe("POST /stop and /start", () => {
  test("stop flips wsRunning false; start flips it back true (restarted with DB id)", async () => {
    const { fn } = stubFetch(() => jsonRes({ speech_engine_id: "eng_toggle" }, 200));
    await speechAdmin.handleSpeechAdminRequest(postJson("/api/settings/speech-engine/create", {}), fn);
    const running = (await (await speechAdmin.handleSpeechAdminRequest(req("/api/settings/speech-engine")))?.json()) as { wsRunning: boolean };
    expect(running.wsRunning).toBe(true);

    const stopRes = await speechAdmin.handleSpeechAdminRequest(postJson("/api/settings/speech-engine/stop", {}));
    expect(await stopRes?.json()).toEqual({ ok: true, wsRunning: false });

    const startRes = await speechAdmin.handleSpeechAdminRequest(postJson("/api/settings/speech-engine/start", {}));
    expect(await startRes?.json()).toEqual({ ok: true, wsRunning: true });
    speech.stopSpeechEngine();
  });

  test("start with no engine id → wsRunning false (nothing to start)", async () => {
    const startRes = await speechAdmin.handleSpeechAdminRequest(postJson("/api/settings/speech-engine/start", {}));
    expect(await startRes?.json()).toEqual({ ok: true, wsRunning: false });
  });
});

describe("POST /delete", () => {
  const del = (body: unknown, fetchImpl?: typeof fetch) =>
    speechAdmin.handleSpeechAdminRequest(postJson("/api/settings/speech-engine/delete", body), fetchImpl);

  test("no effective id and no body id → 400, no upstream call", async () => {
    const { fn, calls } = stubFetch(() => jsonRes({}, 200));
    const res = await del({}, fn);
    expect(res?.status).toBe(400);
    expect(((await res?.json()) as { error: string }).error).toBe("no_engine");
    expect(calls.length).toBe(0);
  });

  test("deletes upstream and clears the DB id only when it matches the deleted one", async () => {
    settingsRepo.setSpeechEngineId("eng_keep");
    const { fn, calls } = stubFetch(() => jsonRes({}, 200));
    // Delete a different id — the stored one must survive.
    const res1 = await del({ id: "eng_other" }, fn);
    expect(await res1?.json()).toMatchObject({ ok: true, deleted: "eng_other" });
    expect(settingsRepo.getSpeechEngineId()?.engineId).toBe("eng_keep");
    expect(calls[0]?.url).toContain("/v1/speech-engine/eng_other");
    expect(calls[0]?.init?.method).toBe("DELETE");
    // Delete the effective id (db) — the stored row must be cleared.
    const res2 = await del({}, fn);
    expect(await res2?.json()).toEqual({ ok: true, deleted: "eng_keep" });
    expect(settingsRepo.getSpeechEngineId()).toBeNull();
  });

  test("env source → delete returns the env-still-set note", async () => {
    process.env.ELEVENLABS_SPEECH_ENGINE_ID = "eng_env_delete";
    const { fn } = stubFetch(() => jsonRes({}, 200));
    const res = await del({}, fn);
    const body = (await res?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, deleted: "eng_env_delete" });
    expect(String(body.note)).toContain("ELEVENLABS_SPEECH_ENGINE_ID");
  });

  test("upstream 404 → forwards httpStatus + message", async () => {
    settingsRepo.setSpeechEngineId("eng_missing_upstream");
    const { fn } = stubFetch(() => jsonRes({ detail: { message: "engine not found" } }, 404));
    const res = await del({}, fn);
    expect(await res?.json()).toMatchObject({ ok: false, httpStatus: 404, message: "engine not found" });
    // Stored id is NOT cleared when the upstream delete failed.
    expect(settingsRepo.getSpeechEngineId()?.engineId).toBe("eng_missing_upstream");
  });
});
