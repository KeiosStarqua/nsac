import "@tanstack/react-start/server-only";
import {
  eventPayloadSchemas,
  eventsPageSchema,
  publishEventBodySchema,
  INJECTABLE_TOPICS,
  type ChangeEvent,
  type EventTopic,
  type PublishEventBody,
} from "../model/events";

const REQUEST_TIMEOUT_MS = 1500;
const DEFAULT_BACKEND_URL = "http://127.0.0.1:3200";
const CONSUMER_ID_REGEX = /^[a-z0-9-]{3,64}$/;
const EVENTS_FETCH_LIMIT = 25;

export type PublishEventInput = {
  topic: EventTopic;
  astronautId?: string | null;
  source: string;
  summary?: string;
  payload: unknown;
};

export type FetchEventsSinceOptions = {
  cursor?: number;
  astronautId?: string;
  topics?: readonly EventTopic[];
  limit?: number;
  timeoutMs?: number;
};

export type EventsSinceResult = { events: ChangeEvent[]; cursor: number };

export type BackendFetch = typeof fetch;

let backendFetchOverride: BackendFetch | null = null;
/** Test hook (mirror setChatSessionFactory): inyect fake fetch; null khôi phục global fetch. */
export function setBackendFetch(fn: BackendFetch | null) {
  backendFetchOverride = fn;
}

function backendBase(): URL | null {
  const base = process.env.BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
  try {
    return new URL(base);
  } catch {
    return null;
  }
}

function fetchWithTimeout(url: URL, init?: RequestInit, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response | null> {
  const doFetch = backendFetchOverride ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return doFetch(url, {
    ...init,
    signal: controller.signal,
    headers: { accept: "application/json", ...init?.headers },
  })
    .catch(() => null)
    .finally(() => clearTimeout(timer));
}

/**
 * Publish một event lên backend. Không bao giờ throw: sai schema/mạng/backend lỗi → false.
 * Backend validate lại lần nữa (nguồn sự thật là zod ở eventsRoutes).
 */
export async function publishEvent(input: PublishEventInput): Promise<boolean> {
  const body: PublishEventBody = {
    topic: input.topic,
    astronautId: input.astronautId ?? undefined,
    source: input.source,
    summary: input.summary,
    payload: input.payload,
  };
  const parsed = publishEventBodySchema.safeParse(body);
  if (!parsed.success) return false;
  // Mirror validation phía backend — payload sai theo topic thì đừng tốn một HTTP round-trip.
  const payloadCheck = eventPayloadSchemas[parsed.data.topic].safeParse(parsed.data.payload);
  if (!payloadCheck.success) return false;

  const base = backendBase();
  if (!base) return false;
  const res = await fetchWithTimeout(new URL("/api/events", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  return res?.ok === true;
}

/**
 * Lấy events kể từ `cursor`. Trả null khi bất kỳ bước nào hỏng (mạng/backend/payload lạ) —
 * caller coi như "không có gì mới", tuyệt đối không throw.
 */
export async function fetchEventsSince(options: FetchEventsSinceOptions = {}): Promise<EventsSinceResult | null> {
  const base = backendBase();
  if (!base) return null;
  const { cursor = 0, astronautId, topics, limit = EVENTS_FETCH_LIMIT, timeoutMs } = options;

  const url = new URL("/api/events", base);
  url.searchParams.set("cursor", String(Math.max(0, Math.trunc(cursor) || 0)));
  url.searchParams.set("limit", String(Math.min(100, Math.max(1, Math.trunc(limit) || EVENTS_FETCH_LIMIT))));
  if (astronautId) url.searchParams.set("astronautId", astronautId);
  if (topics && topics.length > 0) url.searchParams.set("topics", topics.join(","));

  const res = await fetchWithTimeout(url, undefined, timeoutMs);
  if (!res?.ok) return null;
  try {
    const json = await res.json();
    const page = eventsPageSchema.safeParse(json);
    if (!page.success) return null;
    return { events: page.data.events, cursor: page.data.cursor };
  } catch {
    return null;
  }
}

/** Cursor hiện tại của consumer; 0 khi backend không reachable / consumer chưa có. */
export async function getCursor(consumerId: string): Promise<number> {
  if (!CONSUMER_ID_REGEX.test(consumerId)) return 0;
  const base = backendBase();
  if (!base) return 0;
  const res = await fetchWithTimeout(new URL(`/api/cursors/${encodeURIComponent(consumerId)}`, base));
  if (!res?.ok) return 0;
  try {
    const json = (await res.json()) as { cursor?: unknown };
    const n = typeof json.cursor === "number" ? json.cursor : Number(json.cursor);
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
  } catch {
    return 0;
  }
}

/**
 * Đặt cursor cho consumer. Monotonic phía backend; hàm này chỉ báo cáo lại giá trị backend xác nhận.
 * Null khi hỏng — caller coi như không tiến được cursor, lần sau đọc lại từ vị trí cũ (at-least-once).
 */
export async function setCursor(consumerId: string, cursor: number): Promise<number | null> {
  if (!CONSUMER_ID_REGEX.test(consumerId)) return null;
  if (!Number.isFinite(cursor) || cursor < 0) return null;
  const base = backendBase();
  if (!base) return null;
  const res = await fetchWithTimeout(new URL(`/api/cursors/${encodeURIComponent(consumerId)}`, base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cursor: Math.trunc(cursor) }),
  });
  if (!res?.ok) return null;
  try {
    const json = (await res.json()) as { cursor?: unknown };
    const n = typeof json.cursor === "number" ? json.cursor : Number(json.cursor);
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
  } catch {
    return null;
  }
}

export { INJECTABLE_TOPICS };
