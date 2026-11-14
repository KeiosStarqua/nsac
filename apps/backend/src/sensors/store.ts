// Store wrapper cho telemetry: sensorsClient (connection riêng) + telemetry repo.
// Engine phụ thuộc interface này — tests inject một collector in-memory thay vì chạm DB.

import { telemetryRepo, type TelemetryEventInsert } from "../db/repositories/telemetry";
import type { TelemetryEvent } from "./envelope";

export interface TelemetryStore {
  insertBatch(events: TelemetryEvent[]): void;
  recent(opts: { deviceId?: string; missionId?: string; limit?: number }): ReturnType<typeof telemetryRepo.recent>;
  maxSequence(missionId: string, deviceId: string): number;
  deleteByMission(missionId: string): number;
}

function toInsert(event: TelemetryEvent): TelemetryEventInsert {
  return {
    eventId: event.event_id,
    missionId: event.mission_id,
    crewId: event.crew_id ?? null,
    deviceId: event.device_id,
    deviceType: event.device_type,
    locationId: event.location_id ?? null,
    sourceMode: event.source.mode,
    datasetId: event.source.dataset_id ?? null,
    observedAt: event.observed_at,
    receivedAt: event.received_at,
    sequence: event.sequence,
    qualityStatus: event.quality.status,
    payload: JSON.stringify(event.payload),
  };
}

export const sensorsStore: TelemetryStore = {
  insertBatch(events) {
    if (events.length === 0) return;
    // Một transaction cho cả batch (SPEC §6.4).
    telemetryRepo.insertBatch(events.map(toInsert));
  },
  recent(opts) {
    return telemetryRepo.recent(opts);
  },
  maxSequence(missionId, deviceId) {
    return telemetryRepo.maxSequence(missionId, deviceId);
  },
  deleteByMission(missionId) {
    return telemetryRepo.deleteByMission(missionId);
  },
};
