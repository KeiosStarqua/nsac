import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Connection riêng cho events, cùng file (SKY_DB_PATH) với connection dùng chung ở client.ts.
// Cùng lý do tách như claimsClient: bun test chia sẻ module cache trong một process, nên
// events.test.ts set SKY_DB_PATH sang tmp file được bất kể thứ tự load. WAL cho phép hai
// connection cùng một file.
const dbPath = process.env.SKY_DB_PATH ?? "../../var/sky.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

// Không lịch sử migration (drizzle/ đang trống), tạo idempotent để DB trắng chạy được.
function ensureSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS change_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id TEXT NULL,
      topic TEXT NOT NULL,
      source TEXT NOT NULL,
      summary TEXT,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  sqlite.exec("CREATE INDEX IF NOT EXISTS change_events_astronaut_id_id ON change_events (astronaut_id, id);");
  sqlite.exec("CREATE INDEX IF NOT EXISTS change_events_topic_id ON change_events (topic, id);");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS consumer_cursors (
      consumer_id TEXT PRIMARY KEY,
      last_event_id INTEGER NOT NULL DEFAULT 0
    );
  `);
}

ensureSchema();

export const eventsDb = drizzle(sqlite);
export type EventsDb = typeof eventsDb;
