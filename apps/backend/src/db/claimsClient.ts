import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Connection riêng cho claims, cùng file (SKY_DB_PATH) với connection dùng chung ở client.ts.
// Lý do tách: bun test chia sẻ module cache giữa các file test trong một process, nên không
// thể đảm bảo claims.test.ts set SKY_DB_PATH trước khi file khác import client.ts — claims
// phải cô lập được sang tmp file bất kể thứ tự load. Hai connection cùng một file SQLite là
// hợp lệ nhờ WAL; client.ts vẫn tự tạo astronaut_claims (ensureSchema) cho connection chung.
const dbPath = process.env.SKY_DB_PATH ?? "../../var/sky.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

// Cùng lý do như ensureSchema trong client.ts: không có lịch sử migration, tạo idempotent.
// astronauts cũng cần ở đây để existence-check trong cùng 1 connection không vỡ trên DB trắng.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS astronauts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role_code TEXT NOT NULL,
    callsign TEXT,
    bio TEXT
  );
`);
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS astronaut_claims (
    astronaut_id TEXT PRIMARY KEY REFERENCES astronauts(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    claimed_at INTEGER NOT NULL
  );
`);

export const claimsDb = drizzle(sqlite);
export type ClaimsDb = typeof claimsDb;
