import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Bảng telemetry synthetic của Sky (SENSOR_SIMULATION_SPEC §7). Chỉ lưu events — registry là code.
// payload là JSON đã validate ở envelope khi ghi; đọc ra phải JSON.parse lại.
export const telemetryEvents = sqliteTable("telemetry_events", {
  eventId: text("event_id").primaryKey(),
  missionId: text("mission_id").notNull(),
  crewId: text("crew_id"),
  deviceId: text("device_id").notNull(),
  deviceType: text("device_type").notNull(),
  locationId: text("location_id"),
  sourceMode: text("source_mode").notNull(),
  datasetId: text("dataset_id"),
  /** UTC ISO-8601, ms precision. */
  observedAt: text("observed_at").notNull(),
  receivedAt: text("received_at").notNull(),
  sequence: integer("sequence").notNull(),
  qualityStatus: text("quality_status").notNull(),
  payload: text("payload").notNull(),
});
