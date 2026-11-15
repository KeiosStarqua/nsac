import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Connection riêng cho clinical routine engine, cùng file (SKY_DB_PATH) với các connection
// khác. Cùng lý do tách như eventsClient/sensorsClient: bun test chia sẻ module cache trong
// một process, nên clinical.test.ts set SKY_DB_PATH sang tmp file được bất kể thứ tự load.
// WAL cho phép nhiều connection cùng một file.
const dbPath = process.env.SKY_DB_PATH ?? "../../var/sky.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

// Không lịch sử migration (drizzle/ đang trống), tạo idempotent để DB trắng chạy được.
// Lưu ý: UNIQUE index trên (routine_id, astronaut_id, bucket) — SQLite coi NULL astronaut_id
// là phân biệt nhau, nên fleet-wide (NULL) không được idempotency ở DB level; V1 không có
// fleet-wide routine, nếu sau này thêm phải dùng sentinel '__all__'.
function ensureSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clinical_findings (
      id                      TEXT PRIMARY KEY,
      astronaut_id            TEXT NOT NULL,
      specialist_id           TEXT NOT NULL,
      observed_at             TEXT NOT NULL,
      metric_ids              TEXT NOT NULL,
      severity                TEXT NOT NULL CHECK (severity IN ('green','yellow','red','unknown')),
      status                  TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','resolved')),
      summary                 TEXT NOT NULL,
      evidence                TEXT NOT NULL,
      requires_medical_review INTEGER NOT NULL DEFAULT 0,
      created_at              INTEGER NOT NULL,
      updated_at              INTEGER NOT NULL
    );
  `);
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS clinical_findings_astronaut_status_created ON clinical_findings (astronaut_id, status, created_at);",
  );
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS clinical_findings_specialist_created ON clinical_findings (specialist_id, created_at);",
  );
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS routine_runs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id    TEXT NOT NULL,
      astronaut_id  TEXT NULL,
      bucket        TEXT NOT NULL,
      status        TEXT NOT NULL CHECK (status IN ('running','ok','skipped_quality','cooldown','failed')),
      attempts      INTEGER NOT NULL DEFAULT 1,
      detail        TEXT,
      started_at    INTEGER NOT NULL,
      finished_at   INTEGER
    );
  `);
  sqlite.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS routine_runs_routine_astronaut_bucket ON routine_runs (routine_id, astronaut_id, bucket);",
  );
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clinical_audit (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      finding_id  TEXT NOT NULL,
      action      TEXT NOT NULL,
      detail      TEXT,
      created_at  INTEGER NOT NULL
    );
  `);
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS clinical_audit_finding ON clinical_audit (finding_id);",
  );
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clinical_state (
      key    TEXT PRIMARY KEY,
      value  TEXT NOT NULL
    );
  `);
}

ensureSchema();

export const clinicalDb = drizzle(sqlite);
export type ClinicalDb = typeof clinicalDb;
