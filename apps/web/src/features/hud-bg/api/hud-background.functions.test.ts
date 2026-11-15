import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCookieValue } from "../../admin/model/admin-auth";

// Same seam as elevenlabs.functions.test.ts: createServerFn is stubbed down to its builder chain
// and the admin cookie is a mutable test value.
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

const { getHudBackgroundPublicFn, getHudBackgroundFn, setHudBackgroundFn } = await import(
  "./hud-background.functions"
);

const SECRET = "test-admin-secret-0123456789";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("hud-background.functions", () => {
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

  it("public read needs no admin cookie and maps galaxy", async () => {
    state.cookie = undefined;
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ background: "galaxy", updatedAt: 1 })));
    expect(await getHudBackgroundPublicFn()).toEqual({ background: "galaxy" });
  });

  it("public read falls back to particles on unreachable backend / garbage", async () => {
    state.cookie = undefined;
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await getHudBackgroundPublicFn()).toEqual({ background: "particles" });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ background: "light-tunnel" })));
    expect(await getHudBackgroundPublicFn()).toEqual({ background: "particles" });
  });

  it("admin read refuses without the cookie (no fetch)", async () => {
    state.cookie = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getHudBackgroundFn()).toEqual({ status: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("admin read maps background + updatedAt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ background: "galaxy", updatedAt: 123 })));
    expect(await getHudBackgroundFn()).toEqual({ status: "ok", background: "galaxy", updatedAt: 123 });
  });

  it("admin read reports backend_error when unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await getHudBackgroundFn()).toEqual({ status: "backend_error" });
  });

  it("admin write PUTs the background and returns the saved value", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ ok: true, background: "galaxy", updatedAt: 456 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await setHudBackgroundFn({ data: { background: "galaxy" } })).toEqual({
      status: "ok",
      background: "galaxy",
      updatedAt: 456,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("admin write maps backend 400 to invalid_background", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ok: false, error: "bad_background" }, false, 400)),
    );
    expect(await setHudBackgroundFn({ data: { background: "galaxy" } })).toEqual({
      status: "invalid_background",
    });
  });
});
