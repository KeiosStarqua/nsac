import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Connection riêng cho telemetry sim, cùng file (SKY_DB_PATH) với các connection khác.
// Cùng lý do tách như eventsClient: bun test chia sẻ module cache trong một process, nên
// sensors-api.test.ts set SKY_DB_PATH sang tmp file được bất kể thứ tự load. WAL cho phép nhiều
// connection cùng một file.
const dbPath = process.env.SKY_DB_PATH ?? "../../var/sky.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

// Không lịch sử migration (drizzle/ đang trống), tạo idempotent để DB trắng chạy được.
function ensureSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS telemetry_events (
      event_id        TEXT PRIMARY KEY,
      mission_id      TEXT NOT NULL,
      crew_id         TEXT NULL,
      device_id       TEXT NOT NULL,
      device_type     TEXT NOT NULL,
      location_id     TEXT NULL,
      source_mode     TEXT NOT NULL CHECK (source_mode IN ('synthetic','replay','real')),
      dataset_id      TEXT NULL,
      observed_at     TEXT NOT NULL,
      received_at     TEXT NOT NULL,
      sequence        INTEGER NOT NULL,
      quality_status  TEXT NOT NULL CHECK (quality_status IN ('good','suspect','invalid')),
      payload         TEXT NOT NULL
    );
  `);
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS telemetry_events_device_time ON telemetry_events (device_id, observed_at);",
  );
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS telemetry_events_mission_time ON telemetry_events (mission_id, observed_at);",
  );
}

ensureSchema();

export const sensorsDb = drizzle(sqlite);
export type SensorsDb = typeof sensorsDb;
