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

const { getHudUiPublicFn, getHudUiFn, setHudUiFn } = await import("./hud-ui.functions");

const SECRET = "test-admin-secret-0123456789";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("hud-ui.functions", () => {
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

  it("public read needs no admin cookie and maps gen", async () => {
    state.cookie = undefined;
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ui: "gen", updatedAt: 1 })));
    expect(await getHudUiPublicFn()).toEqual({ ui: "gen" });
  });

  it("public read falls back to mock on unreachable backend / garbage", async () => {
    state.cookie = undefined;
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await getHudUiPublicFn()).toEqual({ ui: "mock" });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ui: "openui" })));
    expect(await getHudUiPublicFn()).toEqual({ ui: "mock" });
  });

  it("admin read refuses without the cookie (no fetch)", async () => {
    state.cookie = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getHudUiFn()).toEqual({ status: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("admin read maps ui + updatedAt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ui: "gen", updatedAt: 123 })));
    expect(await getHudUiFn()).toEqual({ status: "ok", ui: "gen", updatedAt: 123 });
  });

  it("admin read reports backend_error when unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await getHudUiFn()).toEqual({ status: "backend_error" });
  });

  it("admin write PUTs the ui and returns the saved value", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, ui: "gen", updatedAt: 456 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await setHudUiFn({ data: { ui: "gen" } })).toEqual({
      status: "ok",
      ui: "gen",
      updatedAt: 456,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("admin write maps backend 400 to invalid_ui", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ok: false, error: "bad_hud_ui" }, false, 400)),
    );
    expect(await setHudUiFn({ data: { ui: "gen" } })).toEqual({ status: "invalid_ui" });
  });
});
