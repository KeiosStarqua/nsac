import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test này: đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào
// src/db/settingsClient.ts, để var/sky.db dùng chung không bao giờ bị đụng. Import động là bắt buộc.
const dir = mkdtempSync(join(tmpdir(), "sky-tts-test-"));
const dbPath = join(dir, "tts.db");

process.env.SKY_DB_PATH = dbPath;

type SettingsModule = typeof import("../src/settingsRoutes");
type TtsModule = typeof import("../src/ttsRoutes");
type SettingsRepoModule = typeof import("../src/db/repositories/settings");

let handleSettingsRequest: SettingsModule["handleSettingsRequest"];
let handleTtsRequest: TtsModule["handleTtsRequest"];
let settingsRepo: SettingsRepoModule["settingsRepo"];

const FAKE_KEY = `sk_${"a".repeat(40)}`;

const getStatus = () => handleSettingsRequest(new Request("http://test/api/settings/elevenlabs-key"));

const putKey = (key: unknown) =>
  handleSettingsRequest(
    new Request("http://test/api/settings/elevenlabs-key", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    }),
  );

const deleteKey = () =>
  handleSettingsRequest(new Request("http://test/api/settings/elevenlabs-key", { method: "DELETE" }));

const postTts = (body: unknown, raw?: string) =>
  handleTtsRequest(
    new Request("http://test/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
  );

const originalFetch = globalThis.fetch;

beforeAll(async () => {
  const settings: SettingsModule = await import("../src/settingsRoutes");
  const tts: TtsModule = await import("../src/ttsRoutes");
  const repo: SettingsRepoModule = await import("../src/db/repositories/settings");
  handleSettingsRequest = settings.handleSettingsRequest;
  handleTtsRequest = tts.handleTtsRequest;
  settingsRepo = repo.settingsRepo;
});

beforeEach(() => {
  // Mặc định test không được đụng mạng: fetch thật bị thay bằng stub ném lỗi, test nào cần
  // upstream thì tự stub lại.
  globalThis.fetch = (() => Promise.reject(new Error("network disabled in test"))) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  rmSync(dir, { recursive: true, force: true });
});

describe("elevenlabs.api_key repo", () => {
  test("roundtrip: set → get → clear → get null", () => {
    expect(settingsRepo.getElevenLabsKey()).toBeNull();
    const saved = settingsRepo.setElevenLabsKey(FAKE_KEY);
    expect(saved.key).toBe(FAKE_KEY);
    expect(typeof saved.updatedAt).toBe("number");
    expect(settingsRepo.getElevenLabsKey()?.key).toBe(FAKE_KEY);
    expect(settingsRepo.clearElevenLabsKey()).toBe(true);
    expect(settingsRepo.getElevenLabsKey()).toBeNull();
    expect(settingsRepo.clearElevenLabsKey()).toBe(false);
  });
});

describe("/api/settings/elevenlabs-key", () => {
  test("GET status false → PUT → true → DELETE → false, key never echoed", async () => {
    const before = await getStatus();
    expect(before?.status).toBe(200);
    expect(await before?.json()).toEqual({ configured: false, updatedAt: null });

    const put = await putKey(FAKE_KEY);
    expect(put?.status).toBe(200);
    const putBody = (await put?.json()) as Record<string, unknown>;
    expect(putBody.ok).toBe(true);
    expect(typeof putBody.updatedAt).toBe("number");
    expect(JSON.stringify(putBody)).not.toContain(FAKE_KEY);

    const during = await getStatus();
    expect(during?.status).toBe(200);
    const duringBody = (await during?.json()) as { configured: boolean; updatedAt: number | null };
    expect(duringBody.configured).toBe(true);
    expect(typeof duringBody.updatedAt).toBe("number");
    expect(JSON.stringify(duringBody)).not.toContain(FAKE_KEY);

    const del = await deleteKey();
    expect(del?.status).toBe(200);
    expect(await del?.json()).toEqual({ ok: true, cleared: true });

    const after = await getStatus();
    expect(await after?.json()).toEqual({ configured: false, updatedAt: null });

    const delAgain = await deleteKey();
    expect(await delAgain?.json()).toEqual({ ok: true, cleared: false });
  });

  test("PUT rejects bad keys with 400 bad_key", async () => {
    for (const bad of ["", "   ", "short", "has space inside", "with\tTab", "with\nNewline", "x".repeat(513), 123, null, { key: "x" }]) {
      const res = await putKey(bad);
      expect(res?.status).toBe(400);
      expect((await res?.json()) as { error: string }).toEqual({ ok: false, error: "bad_key" });
    }
    expect(settingsRepo.getElevenLabsKey()).toBeNull();
  });

  test("PUT trims surrounding whitespace before validating", async () => {
    const res = await putKey(`  ${FAKE_KEY}  `);
    expect(res?.status).toBe(200);
    expect(settingsRepo.getElevenLabsKey()?.key).toBe(FAKE_KEY);
    expect(settingsRepo.clearElevenLabsKey()).toBe(true);
  });

  test("malformed JSON body → 400", async () => {
    const res = await handleSettingsRequest(
      new Request("http://test/api/settings/elevenlabs-key", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res?.status).toBe(400);
  });

  test("other methods fall through (null)", async () => {
    const post = await handleSettingsRequest(new Request("http://test/api/settings/elevenlabs-key", { method: "POST" }));
    expect(post).toBeNull();
    const other = await handleSettingsRequest(new Request("http://test/api/settings/other"));
    expect(other).toBeNull();
  });
});

describe("/api/tts", () => {
  test("POST without a configured key → 503 tts_not_configured, no upstream call", async () => {
    expect(settingsRepo.getElevenLabsKey()).toBeNull();
    const fetchStub = (() => Promise.reject(new Error("must not be called"))) as unknown as typeof fetch;
    globalThis.fetch = fetchStub;
    const res = await postTts({ text: "ping" });
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ ok: false, error: "tts_not_configured" });
  });

  test("POST with a configured key and upstream 401 → 502 tts_upstream (not a crash)", async () => {
    settingsRepo.setElevenLabsKey(FAKE_KEY);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response("unauthorized", { status: 401 });
    }) as unknown as typeof fetch;

    const res = await postTts({ text: "ping" });
    expect(res?.status).toBe(502);
    expect(await res?.json()).toEqual({ ok: false, error: "tts_upstream" });
    expect(calls.length).toBe(1);
    expect(calls[0].url).toContain("https://api.elevenlabs.io/v1/text-to-speech/");
    // Key đi lên upstream qua header, không lộ ra response.
    expect((calls[0].init?.headers as Record<string, string>)["xi-api-key"]).toBe(FAKE_KEY);
    settingsRepo.clearElevenLabsKey();
  });

  test("POST with upstream network failure → 502 tts_upstream", async () => {
    settingsRepo.setElevenLabsKey(FAKE_KEY);
    globalThis.fetch = (() => Promise.reject(new Error("ENOTFOUND"))) as unknown as typeof fetch;
    const res = await postTts({ text: "ping" });
    expect(res?.status).toBe(502);
    expect(await res?.json()).toEqual({ ok: false, error: "tts_upstream" });
    settingsRepo.clearElevenLabsKey();
  });

  test("POST with upstream 200 → audio/mpeg bytes pass through with no-store", async () => {
    settingsRepo.setElevenLabsKey(FAKE_KEY);
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04]); // "ID3" magic
    globalThis.fetch = (async () => new Response(bytes, { status: 200 })) as unknown as typeof fetch;
    const res = await postTts({ text: "ping" });
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toBe("audio/mpeg");
    expect(res?.headers.get("cache-control")).toBe("no-store");
    expect(new Uint8Array(await res!.arrayBuffer())).toEqual(bytes);
    settingsRepo.clearElevenLabsKey();
  });

  test("POST validates the body", async () => {
    for (const bad of [{}, { text: "" }, { text: "x".repeat(1001) }, { text: 42 }]) {
      const res = await postTts(bad);
      expect(res?.status).toBe(400);
      expect(await res?.json()).toEqual({ ok: false, error: "bad_body" });
    }
    const malformed = await postTts(undefined, "not-json");
    expect(malformed?.status).toBe(400);
  });

  test("other paths/methods fall through (null)", async () => {
    expect(await handleTtsRequest(new Request("http://test/api/tts", { method: "GET" }))).toBeNull();
    expect(await handleTtsRequest(new Request("http://test/api/tts/other", { method: "POST" }))).toBeNull();
  });
});
