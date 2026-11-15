import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCookieValue } from "../model/admin-auth";

// Mirrors admin.functions.test.ts: createServerFn is stubbed down to its builder chain and the
// admin cookie is backed by a mutable test cookie. The key must never appear in any result.
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

const { getElevenLabsStatusFn, setElevenLabsKeyFn, clearElevenLabsKeyFn } = await import("./elevenlabs.functions");

const SECRET = "test-admin-secret-0123456789";
const FAKE_KEY = `sk_${"a".repeat(40)}`;

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("elevenlabs.functions", () => {
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
    expect(await getElevenLabsStatusFn()).toEqual({ configured: false, updatedAt: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unreachable backend ⇒ configured: false, no crash", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await getElevenLabsStatusFn()).toEqual({ configured: false, updatedAt: null });
  });

  it("status maps the backend payload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ configured: true, updatedAt: 123 })));
    expect(await getElevenLabsStatusFn()).toEqual({ configured: true, updatedAt: 123 });
  });

  it("set validates the key shape before any fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await setElevenLabsKeyFn({ data: { key: "short" } })).toEqual({ status: "invalid_key" });
    expect(await setElevenLabsKeyFn({ data: { key: "has space in it here" } })).toEqual({ status: "invalid_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("set PUTs the key and never echoes it back", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, updatedAt: 456 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await setElevenLabsKeyFn({ data: { key: FAKE_KEY } });
    expect(result).toEqual({ status: "ok", updatedAt: 456 });
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3200/api/settings/elevenlabs-key");
    expect(init.method).toBe("PUT");
    expect(String(init.body)).toContain(FAKE_KEY); // key only ever travels to the loopback backend
  });

  it("set maps backend bad_key → invalid_key, other non-2xx → backend_error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false, error: "bad_key" }, false, 400)));
    expect(await setElevenLabsKeyFn({ data: { key: FAKE_KEY } })).toEqual({ status: "invalid_key" });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false }, false, 500)));
    expect(await setElevenLabsKeyFn({ data: { key: FAKE_KEY } })).toEqual({ status: "backend_error" });
  });

  it("set refuses without the admin cookie (no fetch)", async () => {
    state.cookie = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await setElevenLabsKeyFn({ data: { key: FAKE_KEY } })).toEqual({ status: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clear DELETEs and reports cleared", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true, cleared: true })));
    expect(await clearElevenLabsKeyFn()).toEqual({ status: "ok", cleared: true });
  });

  it("clear refuses without the admin cookie (no fetch)", async () => {
    state.cookie = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await clearElevenLabsKeyFn()).toEqual({ status: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
