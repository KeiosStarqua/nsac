import EventEmitter3 from "eventemitter3";
import { z } from "zod";
import { eventsDb } from "./db/eventsClient";
import { changeEvents, consumerCursors } from "./db/schema/changeEvents";
import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm";

// Blog/demo single-box: endpoint mở, không auth theo thiết kế demo (giống /api/claims).
// Broadcast chỉ mang facts/events — không mệnh lệnh, không dữ liệu cá nhân.
export const EVENT_TOPICS = [
  "hazard.detected",
  "health.fact.updated",
  "claims.changed",
  "agent.turn.completed",
  "medical.finding.created",
  "medical.finding.resolved",
  "medical.review.requested",
] as const;
export type EventTopic = (typeof EVENT_TOPICS)[number];

const EVENT_TOPIC_SET = new Set<string>(EVENT_TOPICS);

// Giới hạn kích thước nghiêm ngặt theo topic — payload nhỏ, một dòng tóm tắt là đủ cho v1.
const severitySchema = z.enum(["green", "yellow", "red"]);

const hazardDetectedPayload = z
  .object({
    hazard: z.string().trim().min(1).max(64),
    severity: severitySchema,
    summary: z.string().max(300).optional(),
    evidenceIds: z.array(z.string().max(64)).max(8).optional(),
  })
  .strict();

/** Payload v1 (legacy) — giữ để web/tool cũ publish được. */
const healthFactLegacyPayload = z
  .object({
    fact: z.string().trim().min(1).max(64),
    value: z.union([z.string().max(300), z.number().finite()]),
    unit: z.string().max(32).optional(),
    severity: severitySchema.optional(),
  })
  .strict();

/**
 * Payload v2 — fact dẫn xuất từ simulator (SENSOR_SIMULATION_SPEC §14, PR4).
 * Chỉ facts: KHÔNG raw reading, KHÔNG 1 Hz stream. `sourceMode` luôn synthetic.
 */
const healthFactDerivedPayload = z
  .object({
    factId: z.string().trim().min(1).max(96),
    missionId: z.string().trim().min(1).max(64),
    crewId: z.string().trim().min(1).max(64).optional(),
    category: z.enum(["cardiovascular", "respiratory", "radiation", "environment"]),
    rule: z.string().trim().min(1).max(64),
    status: z.enum(["active", "resolved"]),
    severity: z.enum(["info", "yellow", "red"]),
    sourceMode: z.literal("synthetic"),
    quality: z.enum(["valid", "suspect", "invalid"]),
    /** Sim clock (UTC ISO-8601). */
    observedAt: z.string().trim().min(1).max(40),
    evidenceEventIds: z.array(z.string().trim().min(1).max(64)).max(8),
  })
  .strict();

const healthFactUpdatedPayload = z.union([healthFactLegacyPayload, healthFactDerivedPayload]);


const claimsChangedPayload = z
  .object({
    astronautId: z.string().trim().min(1).max(64),
    action: z.enum(["claimed", "reset"]),
  })
  .strict();

// Medical payloads dùng severity 4 giá trị (thêm "unknown" — silence is not safety).
const medicalSeveritySchema = z.enum(["green", "yellow", "red", "unknown"]);

const medicalFindingCreatedPayload = z
  .object({
    findingId: z.string().trim().min(1).max(64),
    specialistId: z.string().trim().min(1).max(64),
    severity: medicalSeveritySchema,
    requiresMedicalReview: z.boolean(),
  })
  .strict();

const medicalFindingResolvedPayload = z
  .object({
    findingId: z.string().trim().min(1).max(64),
    action: z.enum(["resolved"]),
  })
  .strict();

// Reserved: chỉ web Medical Officer tương lai mới phát topic này; backend chỉ chấp nhận + lưu.
const medicalReviewRequestedPayload = z
  .object({
    reason: z.string().trim().min(1).max(300),
  })
  .strict();

const agentTurnCompletedPayload = z
  .object({
    astronautId: z.string().trim().min(1).max(64),
    agentId: z.string().trim().min(1).max(64),
    ok: z.boolean(),
  })
  .strict();

export const eventPayloadSchemas = {
  "hazard.detected": hazardDetectedPayload,
  "health.fact.updated": healthFactUpdatedPayload,
  "claims.changed": claimsChangedPayload,
  "agent.turn.completed": agentTurnCompletedPayload,
  "medical.finding.created": medicalFindingCreatedPayload,
  "medical.finding.resolved": medicalFindingResolvedPayload,
  "medical.review.requested": medicalReviewRequestedPayload,
} as const;

const postBodyShape = z
  .object({
    topic: z.string(),
    astronautId: z.string().trim().min(1).max(64).nullish(),
    source: z.string().trim().min(1).max(64),
    summary: z.string().max(300).optional(),
    payload: z.unknown(),
  })
  .strict();

const MAX_BODY_BYTES = 8192;
const CONSUMER_ID_REGEX = /^[a-z0-9-]{3,64}$/;

// In-process notifier cho v1 (single box). Subscriber duy nhất đăng ký ở server.ts (log dòng).
// KHÔNG dùng làm kênh agent→agent: mọi giao tiếp agent đi qua dispatch hiện có.
export const eventsBus = new EventEmitter3();

export type PublishedEvent = {
  id: number;
  astronautId: string | null;
  topic: EventTopic;
  source: string;
  summary: string | null;
  payload: Record<string, unknown>;
  createdAt: number;
};

function isTopic(t: string): t is EventTopic {
  return EVENT_TOPIC_SET.has(t);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function serializeRow(row: typeof changeEvents.$inferSelect): PublishedEvent {
  const payload = safeJsonParse(row.payload);
  return {
    id: row.id,
    astronautId: row.astronautId ?? null,
    topic: row.topic as EventTopic,
    source: row.source,
    summary: row.summary ?? null,
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {},
    createdAt: row.createdAt,
  };
}

function lenientInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Xử lý các route /api/events và /api/cursors. Trả về `null` khi path không thuộc về events
 * để server.ts fall-through như hiện có. Endpoint POST mở (demo), validation chặt qua zod.
 */
export async function handleEventsRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);

  if (url.pathname === "/api/events") {
    if (req.method === "POST") return postEvent(req);
    if (req.method === "GET") return listEvents(url);
    return null;
  }

  const m = url.pathname.match(/^\/api\/cursors\/([^/]+)$/);
  if (m) {
    if (req.method === "GET") return getCursor(m[1]);
    if (req.method === "POST") return postCursor(req, m[1]);
    return null;
  }

  return null;
}

async function postEvent(req: Request): Promise<Response> {
  // Chặn sớm theo Content-Length khi có; luôn kiểm tra lại sau khi đọc body.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const body = safeJsonParse(text);
  if (body === undefined) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const shape = postBodyShape.safeParse(body);
  if (!shape.success) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const { topic, astronautId, source, summary, payload } = shape.data;
  if (!isTopic(topic)) {
    return Response.json({ ok: false, error: "bad_topic" }, { status: 400 });
  }
  const parsedPayload = eventPayloadSchemas[topic].safeParse(payload);
  if (!parsedPayload.success) {
    return Response.json({ ok: false, error: "bad_payload" }, { status: 400 });
  }

  const now = Date.now();
  const inserted = eventsDb
    .insert(changeEvents)
    .values({
      astronautId: astronautId ?? null,
      topic,
      source,
      summary: summary ?? null,
      payload: JSON.stringify(parsedPayload.data),
      createdAt: now,
    })
    .returning({ id: changeEvents.id })
    .all()[0];

  const event: PublishedEvent = {
    id: inserted.id,
    astronautId: astronautId ?? null,
    topic,
    source,
    summary: summary ?? null,
    payload: parsedPayload.data as Record<string, unknown>,
    createdAt: now,
  };
  eventsBus.emit("published", event);
  return Response.json({ ok: true, id: inserted.id });
}

function listEvents(url: URL): Response {
  const cursor = lenientInt(url.searchParams.get("cursor"), 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = lenientInt(url.searchParams.get("limit"), 50, 1, 100);
  const astronautId = url.searchParams.get("astronautId")?.trim().slice(0, 64) || undefined;
  const rawTopics = url.searchParams.get("topics");
  const topics = rawTopics
    ? Array.from(new Set(rawTopics.split(",").map((t) => t.trim()).filter(isTopic)))
    : undefined;
  // Lọc theo topics nhưng không có topic hợp lệ nào → trả về rỗng thay vì bỏ qua bộ lọc.
  if (rawTopics && topics?.length === 0) {
    return Response.json({ events: [], cursor });
  }

  const conditions = [gt(changeEvents.id, cursor)];
  if (astronautId) {
    // Global (NULL) luôn nhìn thấy; astronaut-scoped chỉ của chính người đó.
    conditions.push(
      or(isNull(changeEvents.astronautId), eq(changeEvents.astronautId, astronautId))!,
    );
  }
  if (topics && topics.length > 0) {
    conditions.push(inArray(changeEvents.topic, topics));
  }

  const rows = eventsDb
    .select()
    .from(changeEvents)
    .where(and(...conditions))
    .orderBy(asc(changeEvents.id))
    .limit(limit)
    .all();

  const events = rows.map(serializeRow);
  const maxId = events.reduce((acc, ev) => Math.max(acc, ev.id), cursor);
  return Response.json({ events, cursor: maxId });
}

function readCursor(consumerId: string): number {
  const row = eventsDb
    .select()
    .from(consumerCursors)
    .where(eq(consumerCursors.consumerId, consumerId))
    .all()[0];
  return row?.lastEventId ?? 0;
}

function getCursor(rawConsumerId: string): Response {
  if (!CONSUMER_ID_REGEX.test(rawConsumerId)) {
    return Response.json({ ok: false, error: "bad_consumer" }, { status: 400 });
  }
  return Response.json({ cursor: readCursor(rawConsumerId) });
}

async function postCursor(req: Request, rawConsumerId: string): Promise<Response> {
  if (!CONSUMER_ID_REGEX.test(rawConsumerId)) {
    return Response.json({ ok: false, error: "bad_consumer" }, { status: 400 });
  }
  const body = safeJsonParse(await req.text());
  const parsed = z
    .object({ cursor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) })
    .strict()
    .safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const current = readCursor(rawConsumerId);
  // Monotonic: lùi con trỏ không bao giờ được phép; client nhận lại giá trị hiện tại.
  if (parsed.data.cursor < current) {
    return Response.json({ cursor: current });
  }
  eventsDb
    .insert(consumerCursors)
    .values({ consumerId: rawConsumerId, lastEventId: parsed.data.cursor })
    .onConflictDoUpdate({
      target: consumerCursors.consumerId,
      set: { lastEventId: parsed.data.cursor },
    })
    .run();
  return Response.json({ cursor: parsed.data.cursor });
}
