import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCookieValue } from "../model/admin-auth";

// The admin server functions are created at module scope by TanStack Start. Tests only need the
// handler body, so `createServerFn` is stubbed down to its builder chain and `getCookie` is
// backed by a mutable test cookie.
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

const { resetClaimsFn } = await import("./admin.functions");

const SECRET = "test-admin-secret-0123456789";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

describe("resetClaimsFn", () => {
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

  it("refuses without the admin session cookie", async () => {
    state.cookie = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await resetClaimsFn()).toEqual({ status: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses when SKY_ADMIN_KEY is not configured", async () => {
    delete process.env.SKY_ADMIN_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await resetClaimsFn()).toEqual({ status: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the backend reset and reports the cleared count", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, cleared: 3 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await resetClaimsFn()).toEqual({ status: "ok", cleared: 3 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3200/api/claims/reset");
    expect(init.method).toBe("POST");
  });

  it("turns a non-2xx backend response into backend_error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false }, false)));

    expect(await resetClaimsFn()).toEqual({ status: "backend_error" });
  });

  it("turns a malformed backend body into backend_error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true })));

    expect(await resetClaimsFn()).toEqual({ status: "backend_error" });
  });

  it("turns a network failure into backend_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    expect(await resetClaimsFn()).toEqual({ status: "backend_error" });
  });
});
