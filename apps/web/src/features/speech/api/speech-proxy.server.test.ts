import { describe, expect, it, vi } from "vitest";
import {
  chatStreamBodySchema,
  handleSpeechConfig,
  handleSpeechRegister,
  handleSpeechToken,
  isCrossSite,
} from "./speechProxy.server";

// Unit tests for the two Speech Engine proxies. The backend itself is stubbed through the
// `fetchImpl` seam — these tests never touch the network.

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const registerReq = (body: unknown, rawBody?: string, site?: string): Request =>
  new Request("http://test/api/speech-register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(site ? { "sec-fetch-site": site } : {}),
    },
    body: rawBody ?? JSON.stringify(body),
  });

const configReq = (site?: string): Request =>
  new Request("http://test/api/speech-config", {
    headers: site ? { "sec-fetch-site": site } : {},
  });

const tokenReq = (site?: string): Request =>
  new Request("http://test/api/speech-token", {
    method: "POST",
    headers: site ? { "sec-fetch-site": site } : {},
  });

describe("isCrossSite", () => {
  it("allows same-origin and missing headers; rejects cross-site", () => {
    expect(isCrossSite(registerReq({ astronautId: "ayla-reyes" }, undefined, "cross-site"))).toBe(true);
    expect(isCrossSite(registerReq({ astronautId: "ayla-reyes" }, undefined, "same-origin"))).toBe(false);
    expect(isCrossSite(registerReq({ astronautId: "ayla-reyes" }))).toBe(false);
  });
});

describe("handleSpeechRegister", () => {
  it("403s a cross-site call and never calls the backend", async () => {
    const fetchImpl = vi.fn();
    const res = await handleSpeechRegister(
      registerReq({ astronautId: "ayla-reyes" }, undefined, "cross-site"),
      fetchImpl as unknown as typeof fetch,
    );
    expect(res.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("400s on a non-JSON body", async () => {
    const fetchImpl = vi.fn();
    const res = await handleSpeechRegister(registerReq(undefined, "{oops"), fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "bad_body" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("400s on an invalid shape (empty id, overlong id, wrong type)", async () => {
    const fetchImpl = vi.fn();
    expect((await handleSpeechRegister(registerReq({ astronautId: "" }), fetchImpl as unknown as typeof fetch)).status).toBe(400);
    expect((await handleSpeechRegister(registerReq({ astronautId: "x".repeat(65) }), fetchImpl as unknown as typeof fetch)).status).toBe(400);
    expect((await handleSpeechRegister(registerReq({ astronautId: 7 }), fetchImpl as unknown as typeof fetch)).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("passes through the backend's { ok: true }", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const res = await handleSpeechRegister(registerReq({ astronautId: "ayla-reyes" }), fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ astronautId: "ayla-reyes" });
  });

  it("502s when the backend does not answer { ok: true }", async () => {
    for (const response of [jsonResponse({ ok: false, error: "unknown_astronaut" }, 404), jsonResponse({ ok: true }, 500), jsonResponse({ nope: true })]) {
      const fetchImpl = vi.fn(async () => response);
      const res = await handleSpeechRegister(registerReq({ astronautId: "ayla-reyes" }), fetchImpl as unknown as typeof fetch);
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ ok: false, error: "speech_backend" });
    }
  });

  it("502s when the backend is unreachable", async () => {
    const fetchImpl = vi.fn(async () => Promise.reject(new Error("down")));
    const res = await handleSpeechRegister(registerReq({ astronautId: "ayla-reyes" }), fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(502);
  });
});

describe("handleSpeechConfig", () => {
  it("403s a cross-site call and never calls the backend", async () => {
    const fetchImpl = vi.fn();
    const res = await handleSpeechConfig(configReq("cross-site"), fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("passes through { engineId }", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ engineId: "seng_123" }));
    const res = await handleSpeechConfig(configReq(), fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ engineId: "seng_123" });
  });

  it("passes through the 404 no_engine signal untouched", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: false, error: "no_engine" }, 404));
    const res = await handleSpeechConfig(configReq(), fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "no_engine" });
  });

  it("502s on other backend failures and unreachable hosts", async () => {
    const failing = vi.fn(async () => jsonResponse({ ok: false, error: "bogus" }, 500));
    expect((await handleSpeechConfig(configReq(), failing as unknown as typeof fetch)).status).toBe(502);
    const down = vi.fn(async () => Promise.reject(new Error("down")));
    expect((await handleSpeechConfig(configReq(), down as unknown as typeof fetch)).status).toBe(502);
  });
});

describe("handleSpeechToken", () => {
  it("403s a cross-site call and never calls the backend", async () => {
    const fetchImpl = vi.fn();
    const res = await handleSpeechToken(tokenReq("cross-site"), fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs to the backend token route and passes the token through", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ token: "conv_token_abc" }));
    const res = await handleSpeechToken(tokenReq(), fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "conv_token_abc" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith("/api/speech/token")).toBe(true);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).accept).toBe("application/json");
    expect(init.body).toBeUndefined();
  });

  it("passes the 404 no_engine signal through untouched", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: false, error: "no_engine" }, 404));
    const res = await handleSpeechToken(tokenReq(), fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "no_engine" });
  });

  it("502s on backend failures, malformed payloads and unreachable hosts", async () => {
    const cases = [
      jsonResponse({ ok: false, error: "no_key" }, 503),
      jsonResponse({ ok: false, error: "upstream" }, 502),
      jsonResponse({ ok: true }),
      jsonResponse({ token: "" }),
      jsonResponse({ token: 7 }),
      jsonResponse({ error: "no_engine" }, 500),
    ];
    for (const response of cases) {
      const fetchImpl = vi.fn(async () => response);
      const res = await handleSpeechToken(tokenReq(), fetchImpl as unknown as typeof fetch);
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ ok: false, error: "speech_backend" });
    }
    const down = vi.fn(async () => Promise.reject(new Error("down")));
    expect((await handleSpeechToken(tokenReq(), down as unknown as typeof fetch)).status).toBe(502);
  });
});

describe("chatStreamBodySchema", () => {
  it("accepts the existing text shape", () => {
    expect(chatStreamBodySchema.safeParse({ astronautId: "ayla-reyes", message: "hi" }).success).toBe(true);
  });

  it("accepts mode: voice and rejects every other mode", () => {
    expect(chatStreamBodySchema.safeParse({ astronautId: "ayla-reyes", message: "hi", mode: "voice" }).success).toBe(true);
    expect(chatStreamBodySchema.safeParse({ astronautId: "ayla-reyes", message: "hi", mode: "text" }).success).toBe(false);
    expect(chatStreamBodySchema.safeParse({ astronautId: "ayla-reyes", message: "hi", mode: 1 }).success).toBe(false);
  });

  it("still rejects overlong messages", () => {
    expect(chatStreamBodySchema.safeParse({ astronautId: "ayla-reyes", message: "x".repeat(501) }).success).toBe(false);
  });
});
