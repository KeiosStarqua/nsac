import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test này: đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào
// src/db/traceClient.ts, để var/sky.db dùng chung không bao giờ bị đụng. Import động là bắt buộc.
const dir = mkdtempSync(join(tmpdir(), "sky-agent-traces-test-"));
const dbPath = join(dir, "agent-traces.db");

process.env.SKY_DB_PATH = dbPath;

type RoutesModule = typeof import("../src/agentTraceRoutes");
type RepoModule = typeof import("../src/db/repositories/agentTraces");
type TraceClientModule = typeof import("../src/db/traceClient");

let handleAgentTraceRequest: RoutesModule["handleAgentTraceRequest"];
let agentTracesRepo: RepoModule["agentTracesRepo"];
let traceDb: TraceClientModule["traceDb"];

const postTrace = (body: unknown, headers?: Record<string, string>) =>
  handleAgentTraceRequest(
    new Request("http://test/api/agent-traces", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const listTraces = (query: string) =>
  handleAgentTraceRequest(new Request(`http://test/api/agent-traces?${query}`));

const getTrace = (id: string | number) =>
  handleAgentTraceRequest(new Request(`http://test/api/agent-traces/${id}`));

const validBody = {
  astronautId: "ayla-reyes",
  agentId: "sky-chat",
  sessionId: "ayla-reyes",
  provider: "openrouter",
  model: "test/model",
  ok: true,
  latencyMs: 1234,
  userText: "hello sky",
  replyText: "hello commander",
  tools: [{ name: "show_on_hud", ok: true, ms: 42 }],
};

beforeAll(async () => {
  const routes: RoutesModule = await import("../src/agentTraceRoutes");
  const repo: RepoModule = await import("../src/db/repositories/agentTraces");
  const client: TraceClientModule = await import("../src/db/traceClient");
  handleAgentTraceRequest = routes.handleAgentTraceRequest;
  agentTracesRepo = repo.agentTracesRepo;
  traceDb = client.traceDb;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("agent-traces", () => {
  test("POST valid → 201 + id, row round-trips", async () => {
    const res = await postTrace(validBody);
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: number };
    expect(id).toBeGreaterThan(0);
    const got = await getTrace(id);
    expect(got.status).toBe(200);
    const row = (await got.json()) as Record<string, unknown>;
    expect(row.astronautId).toBe("ayla-reyes");
    expect(row.agentId).toBe("sky-chat");
    expect(row.ok).toBe(true);
    expect(row.latencyMs).toBe(1234);
    expect(row.tools).toEqual([{ name: "show_on_hud", ok: true, ms: 42 }]);
    expect(row.createdAt).toBeGreaterThan(0);
  });

  test("POST missing required field → 400", async () => {
    const { userText, ...rest } = validBody;
    const res = await postTrace(rest);
    expect(res.status).toBe(400);
  });

  test("POST unknown key (strict) → 400", async () => {
    const res = await postTrace({ ...validBody, nope: true });
    expect(res.status).toBe(400);
  });

  test("POST oversized userText → 400", async () => {
    const res = await postTrace({ ...validBody, userText: "x".repeat(4001) });
    expect(res.status).toBe(400);
  });

  test("POST tool args are not accepted (strict tool schema) → 400", async () => {
    const res = await postTrace({
      ...validBody,
      tools: [{ name: "show_on_hud", args: { brief: "secret prompt" } }],
    });
    expect(res.status).toBe(400);
  });

  test("POST tools > 20 entries → 400", async () => {
    const res = await postTrace({
      ...validBody,
      tools: Array.from({ length: 21 }, () => ({ name: "show_on_hud" })),
    });
    expect(res.status).toBe(400);
  });

  test("POST Content-Length declared > 12 KB → 413", async () => {
    const res = await postTrace(validBody, { "content-length": String(13 * 1024) });
    expect(res.status).toBe(413);
  });

  test("POST body > 12 KB → 413", async () => {
    const res = await postTrace({ ...validBody, userText: "x".repeat(4000), replyText: "y".repeat(4000), tools: undefined, pad: "z".repeat(6000) });
    // pad is an unknown strict key, but the size cap fires before schema validation
    expect(res.status).toBe(413);
  });

  test("POST redacts key-shaped strings in text fields", async () => {
    const res = await postTrace({
      ...validBody,
      userText: "key sk-or-v1-abcdef1234567890 and Bearer abcdef1234567890abcdef",
      replyText: "token sk_abcdefghijklmnop leaked",
    });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: number };
    const row = (await (await getTrace(id)).json()) as { userText: string; replyText: string };
    expect(row.userText).not.toContain("sk-or-v1-abcdef1234567890");
    expect(row.userText).not.toContain("abcdef1234567890abcdef");
    expect(row.userText).toContain("[redacted]");
    expect(row.replyText).not.toContain("sk_abcdefghijklmnop");
    expect(row.replyText).toContain("[redacted]");
  });

  test("redactText handles oc_sk_ keys and is idempotent on clean text", async () => {
    const { redactText } = await import("../src/db/repositories/agentTraces");
    expect(redactText("oc_sk_deadbeef1234 tail")).toBe("[redacted] tail");
    expect(redactText("oc_sk_deadbeef1234")).toBe("[redacted]");
    expect(redactText("plain text, nothing to hide")).toBe("plain text, nothing to hide");
  });

  test("GET list: filters by astronautId/agentId/ok/since, newest first, limit clamp", async () => {
    const first = (await (await postTrace({ ...validBody, astronautId: "dae-jung-park", agentId: "sky-hud-composer", ok: false, errorCode: "timeout", userText: "composer turn" })).json()) as { id: number };
    const second = (await (await postTrace({ ...validBody, astronautId: "dae-jung-park", agentId: "sky-hud-composer", ok: true, userText: "composer turn 2" })).json()) as { id: number };

    const byAstronaut = (await (await listTraces("astronautId=dae-jung-park&limit=10")).json()) as { rows: Array<{ id: number }> };
    expect(byAstronaut.rows[0].id).toBe(second.id);
    expect(byAstronaut.rows[1].id).toBe(first.id);

    const byAgent = (await (await listTraces("agentId=sky-hud-composer&limit=10")).json()) as { rows: Array<{ id: number; agentId: string }> };
    expect(byAgent.rows.length).toBeGreaterThan(0);
    expect(byAgent.rows.every((r) => r.agentId === "sky-hud-composer")).toBe(true);
    expect(byAgent.rows.some((r) => r.id === second.id)).toBe(true);

    const onlyFailed = (await (await listTraces("astronautId=dae-jung-park&ok=false&limit=10")).json()) as { rows: Array<{ ok: boolean }> };
    expect(onlyFailed.rows.length).toBeGreaterThan(0);
    expect(onlyFailed.rows.every((r) => r.ok === false)).toBe(true);

    const since = (await (await listTraces(`since=${Date.now() + 60_000}&limit=10`)).json()) as { rows: unknown[] };
    expect(since.rows).toHaveLength(0);

    const clamped = (await (await listTraces("limit=9999")).json()) as { limit: number };
    expect(clamped.limit).toBe(200);
    const defaulted = (await (await listTraces("")).json()) as { limit: number };
    expect(defaulted.limit).toBe(50);
  });

  test("GET /:id unknown → 404", async () => {
    const res = await getTrace(99999999);
    expect(res.status).toBe(404);
  });

  test("pruneTraces deletes rows older than 7 days", async () => {
    const res = await postTrace({ ...validBody, userText: "old turn" });
    const { id } = (await res.json()) as { id: number };
    const { sql } = await import("drizzle-orm");
    traceDb.run(sql`UPDATE agent_traces SET created_at = ${Date.now() - 8 * 24 * 60 * 60 * 1000} WHERE id = ${id}`);
    const { pruneTraces } = await import("../src/db/repositories/agentTraces");
    const deleted = pruneTraces();
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await getTrace(id).then((r) => r.status)).toBe(404);
  });

  test("repository caps oversized values instead of throwing", () => {
    const { id } = agentTracesRepo.insertTrace({
      astronautId: "x".repeat(500),
      agentId: "sky-chat",
      latencyMs: Number.NaN,
      userText: "y".repeat(10_000),
      ok: true,
    });
    expect(id).toBeGreaterThan(0);
  });
});
