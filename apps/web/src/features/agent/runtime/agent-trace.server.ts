import "@tanstack/react-start/server-only";

// Ghi một dòng telemetry MỖI KHI một agent turn kết thúc (HARNESSING §16): backend SQLite
// `agent_traces` qua HTTP loopback — coding agents đọc lại bằng curl/scripts/agent-traces.sh.
// Không bao giờ throw: sai schema/mạng/backend lỗi → false. Turn vẫn trả lời bình thường.
// Trace này là debug telemetry, KHÔNG phải nguồn sự thật của chat history (đó là var/sky-sessions).
const REQUEST_TIMEOUT_MS = 1200;
const DEFAULT_BACKEND_URL = "http://127.0.0.1:3200";
const MAX_TEXT = 4000;
const MAX_ID_LEN = 64;
const MAX_MODEL_LEN = 200;
const MAX_SESSION_LEN = 128;
const MAX_TOOLS = 20;

export type AgentTraceTool = { name: string; ok?: boolean; ms?: number };

export type RecordTurnTraceInput = {
  astronautId: string;
  agentId: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  ok: boolean;
  errorCode?: string;
  latencyMs: number;
  userText: string;
  replyText?: string;
  tools?: AgentTraceTool[];
};

export type TraceFetch = typeof fetch;

let traceFetchOverride: TraceFetch | null = null;
/** Test hook (mirror setBackendFetch): inyect fake fetch; null khôi phục global fetch. */
export function setTraceFetch(fn: TraceFetch | null) {
  traceFetchOverride = fn;
}

function backendBase(): URL | null {
  const base = process.env.BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
  try {
    return new URL(base);
  } catch {
    return null;
  }
}

const cap = (value: string | undefined, max: number): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : undefined;

/**
 * POST /api/agent-traces. Trả `true` khi backend nhận (2xx), `false` khi bất kỳ bước nào hỏng.
 * Disabled hoàn toàn khi SKY_TRACE_DISABLED=1 (vd. dev loop không muốn ghi DB).
 * Không bao giờ throw — caller có thể `await` an toàn; timeout cứng 1200 ms.
 */
export async function recordTurnTrace(input: RecordTurnTraceInput): Promise<boolean> {
  try {
    if (process.env.SKY_TRACE_DISABLED === "1") return false;
    const base = backendBase();
    if (!base) return false;
    const astronautId = cap(input.astronautId, MAX_ID_LEN);
    const agentId = cap(input.agentId, MAX_ID_LEN);
    const userText = typeof input.userText === "string" ? input.userText.slice(0, MAX_TEXT) : "";
    if (!astronautId || !agentId || userText === "") return false;
    const tools = Array.isArray(input.tools)
      ? input.tools.slice(0, MAX_TOOLS).flatMap((t) => {
          const name = cap(t?.name, MAX_ID_LEN);
          if (!name) return [];
          const entry: AgentTraceTool = { name };
          if (typeof t.ok === "boolean") entry.ok = t.ok;
          if (typeof t.ms === "number" && Number.isFinite(t.ms) && t.ms >= 0) entry.ms = Math.min(Math.round(t.ms), 3_600_000);
          return [entry];
        })
      : undefined;
    const body = {
      astronautId,
      agentId,
      ...(cap(input.sessionId, MAX_SESSION_LEN) ? { sessionId: cap(input.sessionId, MAX_SESSION_LEN) } : {}),
      ...(cap(input.provider, MAX_ID_LEN) ? { provider: cap(input.provider, MAX_ID_LEN) } : {}),
      ...(cap(input.model, MAX_MODEL_LEN) ? { model: cap(input.model, MAX_MODEL_LEN) } : {}),
      ok: input.ok === true,
      ...(cap(input.errorCode, MAX_ID_LEN) ? { errorCode: cap(input.errorCode, MAX_ID_LEN) } : {}),
      latencyMs:
        Number.isFinite(input.latencyMs) && input.latencyMs >= 0
          ? Math.min(Math.round(input.latencyMs), 3_600_000)
          : 0,
      userText,
      ...(typeof input.replyText === "string" && input.replyText !== ""
        ? { replyText: input.replyText.slice(0, MAX_TEXT) }
        : {}),
      ...(tools && tools.length > 0 ? { tools } : {}),
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const doFetch = traceFetchOverride ?? fetch;
      const res = await doFetch(new URL("/api/agent-traces", base), {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      return res.ok === true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // swallow — telemetry không được phép làm hỏng turn
    return false;
  }
}
