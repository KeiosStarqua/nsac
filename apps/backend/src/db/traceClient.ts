import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Connection riêng cho agent traces, cùng file (SKY_DB_PATH) với connection dùng chung ở client.ts.
// Cùng lý do tách như eventsClient/claimsClient: bun test chia sẻ module cache trong một process,
// nên agent-traces.test.ts set SKY_DB_PATH sang tmp file được bất kể thứ tự load.
// WAL cho phép nhiều connection cùng một file.
const dbPath = process.env.SKY_DB_PATH ?? "../../var/sky.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

// Không lịch sử migration (drizzle/ đang trống), tạo idempotent để DB trắng chạy được.
function ensureSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      session_id TEXT,
      provider TEXT,
      model TEXT,
      ok INTEGER NOT NULL,
      error_code TEXT,
      latency_ms INTEGER NOT NULL,
      user_text TEXT NOT NULL,
      reply_text TEXT,
      tools_json TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  sqlite.exec("CREATE INDEX IF NOT EXISTS agent_traces_astronaut_id_id ON agent_traces (astronaut_id, id);");
  sqlite.exec("CREATE INDEX IF NOT EXISTS agent_traces_agent_id_created_at ON agent_traces (agent_id, created_at);");
}

ensureSchema();

export const traceDb = drizzle(sqlite);
export type TraceDb = typeof traceDb;
