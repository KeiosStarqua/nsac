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
  ensureBaseSchema(sqlite);
  ensureHealthLiveSchema(sqlite);
}

/** Bảng lõi (astronauts/claims/settings/health_observations). Export cho test dựng DB riêng. */
export function ensureBaseSchema(handle: Database) {
  // astronauts cần có trước để seed() chạy được trên DB trắng (vd. smoke test với SKY_DB_PATH
  // tạm); các bảng domain khác giữ nguyên, vẫn tạo thủ công qua db:push như trước.
  handle.exec(`
    CREATE TABLE IF NOT EXISTS astronauts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role_code TEXT NOT NULL,
      callsign TEXT,
      bio TEXT
    );
  `);
  handle.exec(`
    CREATE TABLE IF NOT EXISTS astronaut_claims (
      astronaut_id TEXT PRIMARY KEY REFERENCES astronauts(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      claimed_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL DEFAULT 0
    );
  `);
  // Claim TTL (tự giải phóng claim idle): DB cũ chưa có last_seen_at → thêm cột + backfill từ
  // claimed_at. Không có lịch sử migration nên phải idempotent (PRAGMA trước khi ALTER) và phải
  // giống hệt khối tương ứng trong claimsClient.ts — hai file cùng tạo/migrate một bảng.
  const claimColumns = handle.query("PRAGMA table_info('astronaut_claims')").all() as Array<{
    name: string;
  }>;
  if (!claimColumns.some((column) => column.name === "last_seen_at")) {
    handle.exec(
      "ALTER TABLE astronaut_claims ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0;",
    );
    handle.exec("UPDATE astronaut_claims SET last_seen_at = claimed_at WHERE last_seen_at = 0;");
  }
  // Cùng lý do như astronaut_claims: không migration, tạo idempotent cho DB mới và prod cũ.
  handle.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  // Health observation layer (năng lượng/cơ/giấc ngủ/nước) — synthetic, xem health/metrics.ts.
  // method/quality là enum đóng; CHECK ở đây thay cho migration không tồn tại.
  handle.exec(`
    CREATE TABLE IF NOT EXISTS health_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      astronaut_id TEXT NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      source TEXT NOT NULL,
      method TEXT NOT NULL CHECK (method IN ('sensor','measured','estimated','self_reported','simulated')),
      quality TEXT NOT NULL CHECK (quality IN ('valid','suspect','invalid')),
      confidence REAL NULL
    );
  `);
  handle.exec(
    "CREATE INDEX IF NOT EXISTS health_observations_astronaut_metric_ts ON health_observations (astronaut_id, metric, ts);",
  );
}

/**
 * Live health projection (SPEC §14 v2, PR2): health_current + health_rollups.
 * Tách khỏi `health_observations` — seed 35 ngày là lịch sử, KHÔNG phải measurement live.
 * Export để test dựng DB riêng (module cache bun test chia sẻ trong một process).
 */
export function ensureHealthLiveSchema(handle: Database) {
  handle.exec(`
    CREATE TABLE IF NOT EXISTS health_current (
      astronaut_id TEXT NOT NULL,
      metric       TEXT NOT NULL,
      value        REAL NOT NULL,
      unit         TEXT NOT NULL,
      quality      TEXT NOT NULL CHECK (quality IN ('valid','suspect','invalid')),
      source       TEXT NOT NULL,
      measured_at  TEXT NOT NULL,
      updated_at   INTEGER NOT NULL,
      PRIMARY KEY (astronaut_id, metric)
    );
  `);
  handle.exec(`
    CREATE TABLE IF NOT EXISTS health_rollups (
      scope         TEXT NOT NULL,
      metric        TEXT NOT NULL,
      bucket        TEXT NOT NULL CHECK (bucket IN ('1m','1h')),
      bucket_start  INTEGER NOT NULL,
      value_min     REAL NOT NULL,
      value_max     REAL NOT NULL,
      value_avg     REAL NOT NULL,
      value_count   INTEGER NOT NULL,
      quality_worst TEXT NOT NULL CHECK (quality_worst IN ('valid','suspect','invalid')),
      PRIMARY KEY (scope, metric, bucket, bucket_start)
    );
  `);
  handle.exec(
    "CREATE INDEX IF NOT EXISTS health_rollups_scope_metric_bucket ON health_rollups (scope, metric, bucket, bucket_start);",
  );
}

ensureSchema();

export const db = drizzle(sqlite);
export type Db = typeof db;
/** Raw handle cho live-health repo (UPSERT aggregate + CASE quality_worst dễ viết bằng SQL). */
export const dbSqlite = sqlite;
