import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCookieValue } from "../model/admin-auth";

// Mirrors elevenlabs.functions.test.ts: createServerFn is stubbed down to its builder chain and the
// admin cookie is backed by a mutable test cookie. No fetch ever leaves the test.
const state = vi.hoisted(() => ({ cookie: undefined as string | undefined }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const build = (): Record<string, unknown> => ({
      validator: () => build(),
      handler: (fn: (ctx: { data?: unknown }) => unknown) => (ctx?: { data?: unknown }) =>
        fn({ data: ctx?.data }),
    });
    return build();
  },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: () => state.cookie,
  setCookie: () => {},
  getRequestProtocol: () => "http",
}));

const {
  getSpeechEngineStatusFn,
  probeSpeechEngineFn,
  createSpeechEngineFn,
  stopSpeechEngineFn,
  startSpeechEngineFn,
  deleteSpeechEngineFn,
} = await import("./speechEngine.functions");

const SECRET = "test-admin-secret-0123456789";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const STATUS_PAYLOAD = {
  ok: true,
  configured: true,
  engineId: "eng_test123",
  source: "db",
  wsRunning: true,
  port: 3300,
  lastError: null,
  apiKeyConfigured: true,
  envOverridesDb: false,
};

describe("speechEngine.functions", () => {
  const originalKey = process.env.SKY_ADMIN_KEY;

  beforeEach(() => {
    process.env.SKY_ADMIN_KEY = SECRET;
    state.cookie = makeCookieValue(SECRET);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    state.cookie = undefined;
    if (originalKey === undefined) delete process.env.SKY_ADMIN_KEY;
    else process.env.SKY_ADMIN_KEY = originalKey;
  });

  it("status refuses without the admin cookie (no fetch)", async () => {
    state.cookie = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getSpeechEngineStatusFn()).toEqual({ status: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("status maps the backend payload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(STATUS_PAYLOAD)));
    const result = await getSpeechEngineStatusFn();
    expect(result).toEqual({ status: "ok", data: STATUS_PAYLOAD });
  });

  it("status → backend_error when the backend is down or the payload is junk", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await getSpeechEngineStatusFn()).toEqual({ status: "backend_error" });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ nope: true })));
    expect(await getSpeechEngineStatusFn()).toEqual({ status: "backend_error" });
  });

  it("probe POSTs {} to the probe endpoint and returns the envelope", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: false, httpStatus: 401, message: "missing convai_read permission" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await probeSpeechEngineFn();
    expect(result).toEqual({
      status: "ok",
      data: { ok: false, httpStatus: 401, message: "missing convai_read permission" },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3200/api/settings/speech-engine/probe");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toBe("{}");
  });

  it("create sends the body through and returns created engine info", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ ok: true, engineId: "eng_new", wsUrl: "wss://nasa.taquangkhoi.com/speech/ws", wsRunning: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await createSpeechEngineFn({ data: {} });
    expect(result).toEqual({
      status: "ok",
      data: { ok: true, engineId: "eng_new", wsUrl: "wss://nasa.taquangkhoi.com/speech/ws", wsRunning: true },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3200/api/settings/speech-engine/create");
    expect(String(init.body)).toBe("{}");
  });

  it("create refuses without the admin cookie (no fetch)", async () => {
    state.cookie = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await createSpeechEngineFn({ data: {} })).toEqual({ status: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stop and start proxy to their endpoints and map wsRunning", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse({ ok: true, wsRunning: false }))
      .mockImplementationOnce(async () => jsonResponse({ ok: true, wsRunning: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await stopSpeechEngineFn()).toEqual({ status: "ok", data: { ok: true, wsRunning: false } });
    expect(await startSpeechEngineFn()).toEqual({ status: "ok", data: { ok: true, wsRunning: true } });
    const [stopUrl] = fetchMock.mock.calls[0] as unknown as [string];
    const [startUrl] = fetchMock.mock.calls[1] as unknown as [string];
    expect(stopUrl).toBe("http://127.0.0.1:3200/api/settings/speech-engine/stop");
    expect(startUrl).toBe("http://127.0.0.1:3200/api/settings/speech-engine/start");
  });

  it("delete passes an explicit id when given and maps the backend envelope", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, deleted: "eng_x", note: "env still set" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await deleteSpeechEngineFn({ data: { id: "eng_x" } });
    expect(result).toEqual({ status: "ok", data: { ok: true, deleted: "eng_x", note: "env still set" } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3200/api/settings/speech-engine/delete");
    expect(String(init.body)).toBe(JSON.stringify({ id: "eng_x" }));
  });

  it("delete without an id sends {} (backend picks the effective id)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: false, error: "no_engine" }, false, 400));
    vi.stubGlobal("fetch", fetchMock);
    const result = await deleteSpeechEngineFn({ data: {} });
    // 400 no_engine envelope is still a well-formed backend response — surfaced to the UI.
    expect(result).toEqual({ status: "ok", data: { ok: false, error: "no_engine" } });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).toBe("{}");
  });

  it("mutations resolve backend_error when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await probeSpeechEngineFn()).toEqual({ status: "backend_error" });
    expect(await stopSpeechEngineFn()).toEqual({ status: "backend_error" });
    expect(await startSpeechEngineFn()).toEqual({ status: "backend_error" });
    expect(await deleteSpeechEngineFn({ data: {} })).toEqual({ status: "backend_error" });
    expect(await createSpeechEngineFn({ data: {} })).toEqual({ status: "backend_error" });
  });
});
