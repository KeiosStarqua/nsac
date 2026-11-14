import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Connection riêng cho app_settings, cùng file (SKY_DB_PATH) với connection dùng chung ở client.ts.
// Cùng lý do tách như claimsClient.ts: bun test chia sẻ module cache giữa các file test trong một
// process, nên repo settings phải cô lập được sang tmp file bất kể thứ tự load. Hai connection cùng
// một file SQLite là hợp lệ nhờ WAL; client.ts vẫn tự tạo app_settings (ensureSchema).
const dbPath = process.env.SKY_DB_PATH ?? "../../var/sky.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

// Cùng lý do như ensureSchema trong client.ts: không có lịch sử migration, tạo idempotent.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

export const settingsDb = drizzle(sqlite);
export type SettingsDb = typeof settingsDb;
