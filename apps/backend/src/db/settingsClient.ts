import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Connection riêng cho app_settings, cùng file (SKY_DB_PATH) với connection dùng chung ở client.ts.
// Cùng lý do tách như claimsClient.ts: bun test chia sẻ module cache giữa các file test trong một
// process, nên repo settings phải cô lập được sang tmp file bất kể thứ tự load. Hai connection cùng
// một file SQLite là hợp lệ nhờ WAL; client.ts vẫn tự tạo app_settings (ensureSchema).
function openSettingsDb(path: string) {
  const sqlite = new Database(path);
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

  return drizzle(sqlite);
}

export type SettingsDb = ReturnType<typeof openSettingsDb>;

let bound: { path: string; db: SettingsDb } | null = null;

/**
 * Connection tới `SKY_DB_PATH` hiện tại. Mở ở lần dùng đầu tiên và mở lại khi env đổi: bun test
 * nạp nhiều file trong một process, mỗi file trỏ `SKY_DB_PATH` vào tmp riêng, và bind lúc import
 * module sẽ khiến file nạp sau đọc nhầm DB của file khác (claims repo dùng settings qua
 * `claims.reset().epoch`). Production: env không đổi ⇒ mở đúng một lần.
 */
export function settingsDb(): SettingsDb {
  const path = process.env.SKY_DB_PATH ?? "../../var/sky.db";
  if (bound?.path !== path) bound = { path, db: openSettingsDb(path) };
  return bound.db;
}
