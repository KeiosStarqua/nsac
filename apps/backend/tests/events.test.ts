import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DB riêng cho test này: đặt SKY_DB_PATH trước khi import bất cứ module nào chạm vào
// src/db/eventsClient.ts, để var/sky.db dùng chung không bao giờ bị đụng. Import động là bắt buộc.
const dir = mkdtempSync(join(tmpdir(), "sky-events-test-"));
const dbPath = join(dir, "events.db");

process.env.SKY_DB_PATH = dbPath;

type EventsModule = typeof import("../src/eventsRoutes");

let handleEventsRequest: EventsModule["handleEventsRequest"];

const postEvent = (body: unknown) =>
  handleEventsRequest(
    new Request("http://test/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const listEvents = (query: string) =>
  handleEventsRequest(new Request(`http://test/api/events?${query}`));

const getCursor = (consumerId: string) =>
  handleEventsRequest(new Request(`http://test/api/cursors/${consumerId}`));

const setCursor = (consumerId: string, cursor: unknown) =>
  handleEventsRequest(
    new Request(`http://test/api/cursors/${consumerId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cursor }),
    }),
  );

const validHazard = {
  topic: "hazard.detected",
  astronautId: "ayla-reyes",
  source: "radiation-worker",
  summary: "Elevated dose rate near module",
  payload: { hazard: "radiation", severity: "yellow", summary: "Dose 1.4x baseline", evidenceIds: ["dosimeter-7"] },
};

beforeAll(async () => {
  const routes: EventsModule = await import("../src/eventsRoutes");
  handleEventsRequest = routes.handleEventsRequest;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("events", () => {
  test("POST valid event → 200 + id", async () => {
    const res = await postEvent(validHazard);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; id: number };
    expect(body.ok).toBe(true);
    expect(body.id).toBeGreaterThan(0);
  });

  test("POST bad topic → 400", async () => {
    const res = await postEvent({ ...validHazard, topic: "vitals.updated" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("bad_topic");
  });

  test("POST bad payload shape → 400", async () => {
    const res = await postEvent({ ...validHazard, payload: { hazard: "radiation" } });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("bad_payload");
  });

  test("POST body > 8KB → 413", async () => {
    const big = { ...validHazard, payload: { hazard: "radiation", severity: "yellow", summary: "x".repeat(9000) } };
    const res = await postEvent(big);
    expect(res.status).toBe(413);
  });

  test("GET with cursor returns only newer rows", async () => {
    const before = (await (await listEvents("cursor=0&limit=100"))!.json()) as { events: Array<{ id: number }> };
    const maxId = Math.max(...before.events.map((e) => e.id));
    const after = (await (await listEvents(`cursor=${maxId}&limit=100`))!.json()) as {
      events: Array<{ id: number }>;
      cursor: number;
    };
    expect(after.events.every((e) => e.id > maxId)).toBe(true);
    expect(after.cursor).toBe(maxId);
  });

  test("astronaut filter includes NULL-scoped rows and excludes other astronauts", async () => {
    const global = await postEvent({
      topic: "health.fact.updated",
      source: "osdr-feed",
      payload: { fact: "spo2", value: 97, unit: "%" },
    });
    expect(global.status).toBe(200);
    await postEvent({
      topic: "health.fact.updated",
      astronautId: "lena-fischer",
      source: "osdr-feed",
      payload: { fact: "hr", value: 88, unit: "bpm" },
    });

    const ayla = (await (await listEvents("astronautId=ayla-reyes&cursor=0&limit=100"))!.json()) as {
      events: Array<{ astronautId: string | null; payload: { fact: string } }>;
    };
    expect(ayla.events.some((e) => e.astronautId === null)).toBe(true);
    expect(ayla.events.every((e) => e.astronautId === null || e.astronautId === "ayla-reyes")).toBe(true);
    expect(ayla.events.some((e) => e.payload.fact === "hr")).toBe(false);

    const lena = (await (await listEvents("astronautId=lena-fischer&cursor=0&limit=100"))!.json()) as {
      events: Array<{ astronautId: string | null; payload: { fact: string } }>;
    };
    expect(lena.events.some((e) => e.payload.fact === "hr")).toBe(true);
    // Global rows visible to everyone.
    expect(lena.events.some((e) => e.astronautId === null)).toBe(true);
  });

  test("topics filter keeps only requested topics", async () => {
    const res = await postEvent({
      topic: "agent.turn.completed",
      astronautId: "ayla-reyes",
      source: "web-astro-chat",
      payload: { astronautId: "ayla-reyes", agentId: "sky-chat", ok: true },
    });
    expect(res.status).toBe(200);
    const filtered = (await (await listEvents("topics=hazard.detected&cursor=0&limit=100"))!.json()) as {
      events: Array<{ topic: string }>;
    };
    expect(filtered.events.length).toBeGreaterThan(0);
    expect(filtered.events.every((e) => e.topic === "hazard.detected")).toBe(true);
  });

  test("cursor get/set is monotonic", async () => {
    const missing = (await (await getCursor("test-consumer"))!.json()) as { cursor: number };
    expect(missing.cursor).toBe(0);

    const set = (await (await setCursor("test-consumer", 41))!.json()) as { cursor: number };
    expect(set.cursor).toBe(41);

    const lower = (await (await setCursor("test-consumer", 10))!.json()) as { cursor: number };
    expect(lower.cursor).toBe(41);

    const readBack = (await (await getCursor("test-consumer"))!.json()) as { cursor: number };
    expect(readBack.cursor).toBe(41);
  });

  test("two sequential pulls behave like a cursor-tracking consumer", async () => {
    await postEvent({
      topic: "claims.changed",
      astronautId: "tomas-ortega",
      source: "web-claims",
      payload: { astronautId: "tomas-ortega", action: "claimed" },
    });

    const first = (await (await listEvents("cursor=0&limit=2"))!.json()) as { events: Array<{ id: number }>; cursor: number };
    expect(first.events.length).toBe(2);

    const second = (await (await listEvents(`cursor=${first.cursor}&limit=2`))!.json()) as {
      events: Array<{ id: number }>;
      cursor: number;
    };
    expect(second.events.length).toBeGreaterThan(0);
    expect(second.events.every((e) => e.id > first.cursor)).toBe(true);
    expect(second.cursor).toBeGreaterThan(first.cursor);
  });

  test("invalid consumerId → 400", async () => {
    expect((await getCursor("UPPERCASE!!"))!.status).toBe(400);
    expect((await getCursor("ab"))!.status).toBe(400);
  });
});
