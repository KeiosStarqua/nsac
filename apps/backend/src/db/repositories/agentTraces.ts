import { and, desc, eq, gte, lt } from "drizzle-orm";
import { traceDb } from "../traceClient";
import { agentTraces } from "../schema/agentTraces";

// Trace rows là debug telemetry cho coding agents (HARNESSING §16) — không phải chat history.
// Mọi text field được cap + redact ở đây (route cũng validate, repo là lớp chặn cuối) để một
// turn không thể làm phình DB và không một key nào lọt vào SQLite.

const MAX_TEXT = 4000;
const MAX_ID_LEN = 64;
const MAX_MODEL_LEN = 200;
const MAX_SESSION_LEN = 128;
const MAX_TOOLS = 20;
const MAX_TOOL_NAME = 64;
const KEEP_ROWS = 5000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Prune only every 50th insert — đủ để bounds giữ mà không trả thêm 2 DELETE mỗi turn. */
const PRUNE_EVERY = 50;

export type AgentTraceTool = { name: string; ok?: boolean; ms?: number };

export type AgentTraceInput = {
  astronautId: string;
  agentId: string;
  sessionId?: string | null;
  provider?: string | null;
  model?: string | null;
  ok: boolean;
  errorCode?: string | null;
  latencyMs: number;
  userText: string;
  replyText?: string | null;
  tools?: AgentTraceTool[] | null;
};

export type AgentTraceRow = {
  id: number;
  astronautId: string;
  agentId: string;
  sessionId: string | null;
  provider: string | null;
  model: string | null;
  ok: boolean;
  errorCode: string | null;
  latencyMs: number;
  userText: string;
  replyText: string | null;
  tools: AgentTraceTool[] | null;
  createdAt: number;
};

// Key-shaped strings → [redacted]. `oc_sk_` trước `sk_` (sk_ là prefix con), `sk-` yêu cầu ≥8 ký
// tự sau để không nuốt chữ thường; `Bearer …` cả hai hoa/thường. Không bao giờ log/echo giá trị gốc.
const REDACTORS: Array<[RegExp, string]> = [
  [/oc_sk_[A-Za-z0-9_-]{4,}/g, "[redacted]"],
  [/sk_[A-Za-z0-9_-]{4,}/g, "[redacted]"],
  [/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]"],
  [/Bearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer [redacted]"],
];

export function redactText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REDACTORS) out = out.replace(pattern, replacement);
  return out;
}

function capText(text: string, max: number = MAX_TEXT): string {
  return text.length > max ? text.slice(0, max) : text;
}

function capId(value: string, max: number = MAX_ID_LEN): string {
  return value.trim().slice(0, max);
}

function sanitizeTools(tools: AgentTraceTool[] | null | undefined): AgentTraceTool[] | null {
  if (!Array.isArray(tools) || tools.length === 0) return null;
  const out: AgentTraceTool[] = [];
  for (const tool of tools.slice(0, MAX_TOOLS)) {
    if (!tool || typeof tool !== "object") continue;
    const name = typeof tool.name === "string" ? tool.name.trim().slice(0, MAX_TOOL_NAME) : "";
    if (!name) continue;
    const entry: AgentTraceTool = { name };
    if (typeof tool.ok === "boolean") entry.ok = tool.ok;
    if (typeof tool.ms === "number" && Number.isFinite(tool.ms) && tool.ms >= 0) {
      entry.ms = Math.min(Math.round(tool.ms), 3_600_000);
    }
    out.push(entry);
  }
  return out.length > 0 ? out : null;
}

function serializeRow(row: typeof agentTraces.$inferSelect): AgentTraceRow {
  let tools: AgentTraceTool[] | null = null;
  if (row.toolsJson) {
    try {
      const parsed: unknown = JSON.parse(row.toolsJson);
      tools = sanitizeTools(parsed as AgentTraceTool[]);
    } catch {
      tools = null;
    }
  }
  return {
    id: row.id,
    astronautId: row.astronautId,
    agentId: row.agentId,
    sessionId: row.sessionId ?? null,
    provider: row.provider ?? null,
    model: row.model ?? null,
    ok: row.ok === 1,
    errorCode: row.errorCode ?? null,
    latencyMs: row.latencyMs,
    userText: row.userText,
    replyText: row.replyText ?? null,
    tools,
    createdAt: row.createdAt,
  };
}

/**
 * Xoá rows cũ hơn 7 ngày và rows nằm ngoài 5000 gần nhất. Chạy best-effort từ insertTrace —
 * lỗi prune không được làm hỏng turn. Trả số rows đã xoá (0 khi không làm gì).
 */
export function pruneTraces(): number {
  let deleted = 0;
  const cutoff = Date.now() - MAX_AGE_MS;
  deleted += traceDb.delete(agentTraces).where(lt(agentTraces.createdAt, cutoff)).run().changes;
  // Row thứ 5000 mới nhất theo id: mọi row cũ hơn nó bị xoá (giữ bounded storage).
  const boundary = traceDb
    .select({ id: agentTraces.id })
    .from(agentTraces)
    .orderBy(desc(agentTraces.id))
    .limit(1)
    .offset(KEEP_ROWS - 1)
    .all()[0];
  if (boundary) {
    deleted += traceDb.delete(agentTraces).where(lt(agentTraces.id, boundary.id)).run().changes;
  }
  return deleted;
}

export const agentTracesRepo = {
  insertTrace(input: AgentTraceInput): { id: number } {
    const tools = sanitizeTools(input.tools);
    const inserted = traceDb
      .insert(agentTraces)
      .values({
        astronautId: capId(input.astronautId),
        agentId: capId(input.agentId),
        sessionId: input.sessionId ? capId(input.sessionId, MAX_SESSION_LEN) : null,
        provider: input.provider ? capId(input.provider) : null,
        model: input.model ? capId(input.model, MAX_MODEL_LEN) : null,
        ok: input.ok ? 1 : 0,
        errorCode: input.errorCode ? capId(input.errorCode) : null,
        latencyMs:
          Number.isFinite(input.latencyMs) && input.latencyMs >= 0
            ? Math.min(Math.round(input.latencyMs), 3_600_000)
            : 0,
        userText: capText(redactText(String(input.userText ?? ""))),
        replyText: input.replyText != null ? capText(redactText(String(input.replyText))) : null,
        toolsJson: tools ? redactText(JSON.stringify(tools)) : null,
        createdAt: Date.now(),
      })
      .returning({ id: agentTraces.id })
      .all()[0];
    // Prune mỗi 50 insert (theo id) — bounded storage mà không trả thêm DELETE mỗi turn.
    if (inserted.id % PRUNE_EVERY === 0) {
      try {
        pruneTraces();
      } catch {
        // best-effort: prune hỏng không được làm hỏng turn
      }
    }
    return { id: inserted.id };
  },

  listTraces(options: {
    astronautId?: string;
    agentId?: string;
    ok?: boolean;
    since?: number;
    limit?: number;
  }): AgentTraceRow[] {
    const conditions = [];
    if (options.astronautId) conditions.push(eq(agentTraces.astronautId, capId(options.astronautId)));
    if (options.agentId) conditions.push(eq(agentTraces.agentId, capId(options.agentId)));
    if (options.ok !== undefined) conditions.push(eq(agentTraces.ok, options.ok ? 1 : 0));
    if (options.since !== undefined && Number.isFinite(options.since)) {
      conditions.push(gte(agentTraces.createdAt, Math.trunc(options.since)));
    }
    const rawLimit = options.limit ?? 50;
    const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.trunc(rawLimit))) : 50;
    const rows = traceDb
      .select()
      .from(agentTraces)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(agentTraces.id))
      .limit(limit)
      .all();
    return rows.map(serializeRow);
  },

  getTrace(id: number): AgentTraceRow | null {
    if (!Number.isInteger(id) || id < 1) return null;
    const row = traceDb.select().from(agentTraces).where(eq(agentTraces.id, id)).all()[0];
    return row ? serializeRow(row) : null;
  },
};
