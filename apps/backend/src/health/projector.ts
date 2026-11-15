// Health projector (SPEC §14 v2, PR2+PR4) — consume frame telemetry đã persist, KHÔNG phải 1 Hz stream.
//
// Luồng: engine.tick() → `telemetry_bus:"telemetry_batch"` → project payload → health_current
// + health_rollups(1m) → rules deterministic → `health.fact.updated` (change_events).
// `hrv_ms` KHÔNG có nguồn telemetry ⇒ không bao giờ fabricate; endpoint live chỉ trả metric có thật.
//
// Quality: telemetry `invalid` bị loại khỏi health_current (không lưu), `suspect` giữ nguyên nhãn.
// Dữ liệu luôn synthetic; không ngưỡng lâm sàng, không chẩn đoán.

import { telemetryBus } from "../sensors/engine";
import type { SimStatus } from "../sensors/engine";
import type { TelemetryEvent } from "../sensors/envelope";
import {
  healthLiveRepo,
  MISSION_SCOPE,
  type HealthLiveStore,
  type HealthQuality,
  type MinuteRollupInput,
} from "../db/repositories/healthLive";
import { HealthRulesEngine, type HealthFact } from "./rules";
import { publishChangeEvent } from "../clinical/publish";
import type { QualityStatus } from "../sensors/envelope";

export const HEALTH_SOURCE_SIM = "sim";
const MINUTE_MS = 60_000;

/** Mapping payload → health metric. `skin_temperature_c` lấy từ biomonitor (thermo-mini chỉ có core). */
const METRIC_MAP: Array<{ device: string; field: string; metric: string; unit: string }> = [
  { device: "biomonitor", field: "heart_rate_bpm", metric: "heart_rate_bpm", unit: "bpm" },
  { device: "pulse-oximeter", field: "spo2_pct", metric: "spo2_pct", unit: "%" },
  { device: "respiratory-assessment", field: "respiratory_rate_bpm", metric: "respiratory_rate_bpm", unit: "breaths/min" },
  { device: "thermo-mini", field: "core_temperature_c", metric: "core_temperature_c", unit: "°C" },
  { device: "biomonitor", field: "skin_temperature_c", metric: "skin_temperature_c", unit: "°C" },
  { device: "bp-ecg", field: "systolic_mmhg", metric: "systolic_mmhg", unit: "mmHg" },
  { device: "bp-ecg", field: "diastolic_mmhg", metric: "diastolic_mmhg", unit: "mmHg" },
  { device: "biomonitor", field: "activity_counts", metric: "activity_counts", unit: "counts" },
  { device: "cad", field: "dose_rate_uSv_h", metric: "dose_rate_uSv_h", unit: "µSv/h" },
  { device: "co2-analyzer", field: "co2_ppm", metric: "co2_ppm", unit: "ppm" },
  { device: "o2-analyzer", field: "o2_pct", metric: "o2_pct", unit: "%" },
  { device: "temperature-sensor", field: "temperature_c", metric: "temperature_c", unit: "°C" },
  { device: "humidity-sensor", field: "humidity_pct", metric: "humidity_pct", unit: "%" },
  { device: "pressure-sensor", field: "pressure_kpa", metric: "pressure_kpa", unit: "kPa" },
  { device: "ergometer", field: "power_w", metric: "power_w", unit: "W" },
  { device: "ergometer", field: "cadence_rpm", metric: "cadence_rpm", unit: "rpm" },
  { device: "ergometer", field: "elapsed_s", metric: "elapsed_s", unit: "s" },
];

/** Metric cabin/mission-scoped — chỉ lưu ở scope `MISSION`, không gắn astronaut. */
const MISSION_ONLY_METRICS = new Set([
  "co2_ppm",
  "o2_pct",
  "temperature_c",
  "humidity_pct",
  "pressure_kpa",
]);

const MAPPINGS_BY_DEVICE = new Map<string, Array<{ field: string; metric: string; unit: string }>>();
for (const entry of METRIC_MAP) {
  const list = MAPPINGS_BY_DEVICE.get(entry.device) ?? [];
  list.push({ field: entry.field, metric: entry.metric, unit: entry.unit });
  MAPPINGS_BY_DEVICE.set(entry.device, list);
}

export interface ProjectedMetric {
  value: number;
  unit: string;
  quality: HealthQuality;
}

export interface ProjectedBatch {
  subject: string;
  /** Sim time (epoch ms) của frame — lấy từ observed_at mới nhất. */
  tsMs: number;
  metrics: Record<string, ProjectedMetric>;
  eventIds: string[];
}

export function healthQualityOf(status: QualityStatus): HealthQuality {
  if (status === "good") return "valid";
  if (status === "suspect") return "suspect";
  return "invalid";
}

const QUALITY_RANK: Record<HealthQuality, number> = { valid: 0, suspect: 1, invalid: 2 };

function worst(a: HealthQuality, b: HealthQuality): HealthQuality {
  return QUALITY_RANK[b] > QUALITY_RANK[a] ? b : a;
}

/**
 * Map một frame telemetry → batch per subject (crew id hoặc MISSION).
 * Dose rate được aggregate vào MISSION (max) để rule radiation có "mission trailing median".
 */
export function projectEvents(events: TelemetryEvent[]): {
  crew: ProjectedBatch[];
  mission: ProjectedBatch | null;
} {
  const crewBatches = new Map<string, ProjectedBatch>();
  const mission: ProjectedBatch = { subject: MISSION_SCOPE, tsMs: 0, metrics: {}, eventIds: [] };

  const add = (batch: ProjectedBatch, metric: string, value: number, unit: string, quality: HealthQuality) => {
    const existing = batch.metrics[metric];
    if (!existing) {
      batch.metrics[metric] = { value, unit, quality };
      return;
    }
    // Cùng metric trong một frame (vd. dose cad 6 crew) → max value, worst quality.
    batch.metrics[metric] = {
      value: Math.max(existing.value, value),
      unit,
      quality: worst(existing.quality, quality),
    };
  };

  for (const event of events) {
    const tsMs = Date.parse(event.observed_at);
    if (!Number.isFinite(tsMs)) continue;
    const mappings = MAPPINGS_BY_DEVICE.get(event.device_id);
    if (!mappings) continue;
    const payload = event.payload as Record<string, unknown>;
    const quality = healthQualityOf(event.quality.status);

    for (const mapping of mappings) {
      const raw = payload[mapping.field];
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;

      // Cabin env: chỉ ở scope MISSION. Dose rate: vừa per-crew (CAD) vừa aggregate MISSION
      // để rule radiation_burst có "mission trailing median".
      const missionOnly = MISSION_ONLY_METRICS.has(mapping.metric);
      if (missionOnly || mapping.metric === "dose_rate_uSv_h") {
        mission.tsMs = Math.max(mission.tsMs, tsMs);
        add(mission, mapping.metric, raw, mapping.unit, quality);
        if (!mission.eventIds.includes(event.event_id)) mission.eventIds.push(event.event_id);
      }
      if (missionOnly) continue;

      const subject = event.crew_id ?? MISSION_SCOPE;
      let batch = crewBatches.get(subject);
      if (!batch) {
        batch = { subject, tsMs: 0, metrics: {}, eventIds: [] };
        crewBatches.set(subject, batch);
      }
      batch.tsMs = Math.max(batch.tsMs, tsMs);
      add(batch, mapping.metric, raw, mapping.unit, quality);
      if (!batch.eventIds.includes(event.event_id)) batch.eventIds.push(event.event_id);
    }
  }

  const crew = [...crewBatches.values()]
    .filter((batch) => batch.subject !== MISSION_SCOPE && batch.tsMs > 0)
    .sort((a, b) => a.subject.localeCompare(b.subject));
  return { crew, mission: mission.tsMs > 0 ? mission : null };
}

export function publishHealthFact(fact: HealthFact): number {
  const { summary, ...payload } = fact;
  return publishChangeEvent(
    "health.fact.updated",
    fact.crewId ?? null,
    "simulation",
    summary.slice(0, 300),
    payload,
  );
}

export interface HealthProjectorDeps {
  store?: HealthLiveStore;
  rules?: HealthRulesEngine;
  publish?: (fact: HealthFact) => void;
  now?: () => number;
  log?: (line: string) => void;
}

export class HealthProjector {
  private readonly store: HealthLiveStore;
  private readonly rules: HealthRulesEngine;
  private readonly publish: (fact: HealthFact) => void;
  private readonly now: () => number;
  private readonly log: (line: string) => void;

  constructor(deps: HealthProjectorDeps = {}) {
    this.store = deps.store ?? healthLiveRepo;
    this.rules = deps.rules ?? new HealthRulesEngine();
    this.publish = deps.publish ?? publishHealthFact;
    this.now = deps.now ?? (() => Date.now());
    this.log = deps.log ?? ((line: string) => console.log(line));
  }

  /** Ingest một frame đã persist; trả các fact đã publish (test/observability). */
  ingest(events: TelemetryEvent[], status?: SimStatus | null): HealthFact[] {
    if (events.length === 0) return [];
    const { crew, mission } = projectEvents(events);
    const updatedAt = this.now();

    const current: Array<{
      astronautId: string;
      metric: string;
      value: number;
      unit: string;
      quality: HealthQuality;
      source: string;
      measuredAt: string;
      updatedAt: number;
    }> = [];
    const rollups: MinuteRollupInput[] = [];

    for (const batch of [...crew, ...(mission ? [mission] : [])]) {
      const bucketStart = Math.floor(batch.tsMs / MINUTE_MS) * MINUTE_MS;
      const measuredAt = new Date(batch.tsMs).toISOString();
      for (const [metric, sample] of Object.entries(batch.metrics)) {
        // Quality filter: invalid không bao giờ vào health_current/rollup (vẫn giữ suspect).
        if (sample.quality === "invalid") continue;
        current.push({
          astronautId: batch.subject,
          metric,
          value: sample.value,
          unit: sample.unit,
          quality: sample.quality,
          source: HEALTH_SOURCE_SIM,
          measuredAt,
          updatedAt,
        });
        rollups.push({
          scope: batch.subject,
          metric,
          bucketStart,
          value: sample.value,
          quality: sample.quality,
        });
      }
    }

    if (current.length > 0) {
      try {
        this.store.upsertCurrent(current);
        this.store.upsertMinuteRollups(rollups);
      } catch (e) {
        // Projector không bao giờ được làm chết sim.
        console.error("[health] projector write failed", e);
      }
    }

    const facts: HealthFact[] = [];
    const exerciseCrew = status && status.scenario === "exercise" ? status.exerciseCrewId : null;
    for (const batch of crew) {
      const produced = this.rules.observe({
        subject: batch.subject,
        tsMs: batch.tsMs,
        metrics: batch.metrics,
        eventIds: batch.eventIds,
        skipCardiovascular: exerciseCrew !== null && exerciseCrew === batch.subject,
      });
      facts.push(...produced);
    }
    if (mission) {
      facts.push(
        ...this.rules.observe({
          subject: mission.subject,
          tsMs: mission.tsMs,
          metrics: mission.metrics,
          eventIds: mission.eventIds,
        }),
      );
    }

    for (const fact of facts) {
      try {
        this.publish(fact);
      } catch (e) {
        console.error("[health] publish fact failed", e);
      }
    }
    return facts;
  }
}

let stopProjector: (() => void) | null = null;

/**
 * Subscriber production cho `telemetry_batch` (idempotent trong một process).
 * Trả handle stop để test/hot-reload gỡ listener.
 */
export function startHealthProjector(deps: HealthProjectorDeps = {}): () => void {
  if (stopProjector) return stopProjector;
  const projector = new HealthProjector(deps);
  const listener = (payload: { events: TelemetryEvent[]; status: SimStatus }) => {
    try {
      projector.ingest(payload.events, payload.status);
    } catch (e) {
      console.error("[health] projector failed", e);
    }
  };
  telemetryBus.on("telemetry_batch", listener);
  const stop = () => {
    telemetryBus.off("telemetry_batch", listener);
    stopProjector = null;
  };
  stopProjector = stop;
  return stop;
}
