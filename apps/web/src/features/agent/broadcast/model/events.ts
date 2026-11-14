import { z } from "zod";

// Wire-mirror của payload schemas phía backend (apps/backend/src/eventsRoutes.ts).
// Không share code giữa hai deployable — sửa một bên thì sửa bên kia. Web chỉ ĐỌC events và
// PUBLISH lại kết quả turn; validation cuối cùng luôn nằm ở backend.
export const EVENT_TOPICS = ["hazard.detected", "health.fact.updated", "claims.changed", "agent.turn.completed"] as const;
export type EventTopic = (typeof EVENT_TOPICS)[number];

// Inject vào prompt chỉ những topic này; agent.turn.completed KHÔNG bao giờ vào prompt
// (nó là telemetry, không phải fact vận hành).
export const INJECTABLE_TOPICS = ["hazard.detected", "health.fact.updated", "claims.changed"] as const;
export type InjectableTopic = (typeof INJECTABLE_TOPICS)[number];
const INJECTABLE_SET = new Set<string>(INJECTABLE_TOPICS);

const severitySchema = z.enum(["green", "yellow", "red"]);

export const hazardDetectedPayloadSchema = z
  .object({
    hazard: z.string().trim().min(1).max(64),
    severity: severitySchema,
    summary: z.string().max(300).optional(),
    evidenceIds: z.array(z.string().max(64)).max(8).optional(),
  })
  .strict();

export const healthFactUpdatedPayloadSchema = z
  .object({
    fact: z.string().trim().min(1).max(64),
    value: z.union([z.string().max(300), z.number().finite()]),
    unit: z.string().max(32).optional(),
    severity: severitySchema.optional(),
  })
  .strict();

export const claimsChangedPayloadSchema = z
  .object({
    astronautId: z.string().trim().min(1).max(64),
    action: z.enum(["claimed", "reset"]),
  })
  .strict();

export const agentTurnCompletedPayloadSchema = z
  .object({
    astronautId: z.string().trim().min(1).max(64),
    agentId: z.string().trim().min(1).max(64),
    ok: z.boolean(),
  })
  .strict();

export const eventPayloadSchemas = {
  "hazard.detected": hazardDetectedPayloadSchema,
  "health.fact.updated": healthFactUpdatedPayloadSchema,
  "claims.changed": claimsChangedPayloadSchema,
  "agent.turn.completed": agentTurnCompletedPayloadSchema,
} as const;

export type HazardDetectedPayload = z.infer<typeof hazardDetectedPayloadSchema>;
export type HealthFactUpdatedPayload = z.infer<typeof healthFactUpdatedPayloadSchema>;
export type ClaimsChangedPayload = z.infer<typeof claimsChangedPayloadSchema>;
export type AgentTurnCompletedPayload = z.infer<typeof agentTurnCompletedPayloadSchema>;
export type EventPayload =
  | HazardDetectedPayload
  | HealthFactUpdatedPayload
  | ClaimsChangedPayload
  | AgentTurnCompletedPayload;

export const topicSchema = z.enum(EVENT_TOPICS);

// Row shape trả về từ GET /api/events. payload giữ unknown: parse theo topic khi cần.
export const changeEventSchema = z.object({
  id: z.number().int().nonnegative(),
  astronautId: z.string().nullable().optional(),
  topic: topicSchema,
  source: z.string().min(1).max(64),
  summary: z.string().nullable().optional(),
  payload: z.unknown(),
  createdAt: z.number().int().nonnegative(),
});
export type ChangeEvent = z.infer<typeof changeEventSchema>;

export const eventsPageSchema = z.object({
  events: z.array(changeEventSchema),
  cursor: z.number().int().nonnegative(),
});
export type EventsPage = z.infer<typeof eventsPageSchema>;

// Body publish lên POST /api/events — backend tự giới hạn 8KB và validate lại.
export const publishEventBodySchema = z
  .object({
    topic: topicSchema,
    astronautId: z.string().trim().min(1).max(64).nullish(),
    source: z.string().trim().min(1).max(64),
    summary: z.string().max(300).optional(),
    payload: z.unknown(),
  })
  .strict();
export type PublishEventBody = z.infer<typeof publishEventBodySchema>;

function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function lineFor(event: ChangeEvent): string | null {
  const summary = event.summary ? oneLine(event.summary) : undefined;
  switch (event.topic) {
    case "hazard.detected": {
      const p = hazardDetectedPayloadSchema.safeParse(event.payload);
      if (!p.success) return null;
      const text = summary ?? p.data.summary ?? `${p.data.hazard} detected`;
      return `- [${p.data.severity}|${oneLine(p.data.hazard)}] ${oneLine(text)} (source: ${oneLine(event.source)})`;
    }
    case "health.fact.updated": {
      const p = healthFactUpdatedPayloadSchema.safeParse(event.payload);
      if (!p.success) return null;
      const text = summary ?? `${p.data.fact}: ${p.data.value}${p.data.unit ? ` ${p.data.unit}` : ""}`;
      return `- [${p.data.severity ?? "info"}|${oneLine(p.data.fact)}] ${oneLine(text)} (source: ${oneLine(event.source)})`;
    }
    case "claims.changed": {
      const p = claimsChangedPayloadSchema.safeParse(event.payload);
      if (!p.success) return null;
      const text = summary ?? `${p.data.astronautId} ${p.data.action}`;
      return `- [info|claims] ${oneLine(text)} (source: ${oneLine(event.source)})`;
    }
    default:
      return null;
  }
}

/**
 * Dựng khối SHARED CONTEXT để ghép SAU tin nhắn của user (không bao giờ thay thế).
 * Oldest first; bỏ qua topic không inject được và row không parse được; hard cap số dòng
 * và tổng ký tự. Trả null khi không có gì đáng đưa vào prompt.
 */
export function buildFactsBlock(
  events: readonly unknown[],
  { maxLines = 10, maxChars = 1200 }: { maxLines?: number; maxChars?: number } = {},
): string | null {
  const parsed: ChangeEvent[] = [];
  for (const raw of events) {
    const row = changeEventSchema.safeParse(raw);
    if (row.success && INJECTABLE_SET.has(row.data.topic)) parsed.push(row.data);
  }
  parsed.sort((a, b) => a.id - b.id);

  const lines: string[] = [];
  let used = 0;
  for (const event of parsed) {
    if (lines.length >= maxLines) break;
    const line = lineFor(event);
    if (!line) continue;
    const piece = (lines.length ? "\n" : "") + line;
    const remaining = maxChars - used;
    if (piece.length <= remaining) {
      lines.push(line);
      used += piece.length;
      continue;
    }
    // Phần còn lại không đủ cho dòng tiếp theo: truncate nếu vẫn còn chỗ đọc được, còn không thì dừng.
    if (remaining >= 12) {
      lines.push(truncate(line, remaining - (lines.length ? 1 : 0)));
      used = maxChars;
    }
    break;
  }
  if (lines.length === 0) return null;
  const block = lines.join("\n");
  return block.length <= maxChars ? block : block.slice(0, maxChars);
}
