import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Debug telemetry cho từng agent turn (§ HARNESSING.md §16): một dòng mỗi turn, ghi bởi web
// sau khi turn xong. Không phải nguồn sự thật cho chat history (đó là var/sky-sessions/*.json);
// chỉ dùng để coding agent truy vấn lỗi/độ trễ/provider/tool calls. `ok` lưu 0/1 (bun:sqlite).
// `tools_json` là JSON array {name, ok?, ms?} — KHÔNG bao giờ chứa tool arguments.
export const agentTraces = sqliteTable("agent_traces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  astronautId: text("astronaut_id").notNull(),
  agentId: text("agent_id").notNull(),
  /** Stem của PI SDK session file (vd. `ayla-reyes`, `ayla-reyes.hud`); nullable. */
  sessionId: text("session_id"),
  provider: text("provider"),
  model: text("model"),
  /** 0 = fail, 1 = ok. */
  ok: integer("ok").notNull(),
  errorCode: text("error_code"),
  /** Wall-clock từ lúc bắt đầu turn tới lúc ghi trace, ms. */
  latencyMs: integer("latency_ms").notNull(),
  userText: text("user_text").notNull(),
  replyText: text("reply_text"),
  /** JSON array {name, ok?, ms?} — đã redact, không args. */
  toolsJson: text("tools_json"),
  /** Unix ms. */
  createdAt: integer("created_at").notNull(),
});
