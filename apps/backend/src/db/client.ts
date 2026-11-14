import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

const dbPath = process.env.SKY_DB_PATH ?? "../../var/sky.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

// Bảng astronaut_claims chưa nằm trong lịch sử migration (drizzle/ đang trống, các bảng khác
// được tạo thủ công qua db:push). Không chạy `drizzle-kit generate` vì nó sẽ sinh lại toàn bộ
// baseline; tạo idempotent ở startup để DB mới và bản prod thiếu bảng tự có, và chạy được
// nhiều lần không lỗi.
function ensureSchema() {
  // astronauts cần có trước để seed() chạy được trên DB trắng (vd. smoke test với SKY_DB_PATH
  // tạm); các bảng domain khác giữ nguyên, vẫn tạo thủ công qua db:push như trước.
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
  // Cùng lý do như astronaut_claims: không migration, tạo idempotent cho DB mới và prod cũ.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

ensureSchema();

export const db = drizzle(sqlite);
export type Db = typeof db;