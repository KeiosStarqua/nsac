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
    claimed_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL DEFAULT 0
  );
`);
// Claim TTL (tự giải phóng claim idle): DB cũ chưa có last_seen_at → thêm cột + backfill từ
// claimed_at. Không có lịch sử migration nên phải idempotent (PRAGMA trước khi ALTER) và phải
// giống hệt khối tương ứng trong client.ts — hai file cùng tạo/migrate một bảng.
const claimColumns = sqlite.query("PRAGMA table_info('astronaut_claims')").all() as Array<{
  name: string;
}>;
if (!claimColumns.some((column) => column.name === "last_seen_at")) {
  sqlite.exec("ALTER TABLE astronaut_claims ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0;");
  sqlite.exec("UPDATE astronaut_claims SET last_seen_at = claimed_at WHERE last_seen_at = 0;");
}

export const claimsDb = drizzle(sqlite);
export type ClaimsDb = typeof claimsDb;
