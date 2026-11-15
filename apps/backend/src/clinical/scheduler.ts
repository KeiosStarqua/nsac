// Routine engine — tick loop, bucket idempotency, cooldown, retry, watermark (HARNESSING §17).
//
// - Timer setInterval(CLINICAL_TICK_SECONDS, default 30), unref(). Disabled khi
//   CLINICAL_DISABLED=1. Khởi động từ server.ts sau seed (cạnh startSpeechEngine).
// - Claim bucket ATOMIQUE: INSERT routine_runs (running) — UNIQUE index
//   (routine_id, astronaut_id, bucket) là cổng. Conflict: nếu row cũ status='failed' và
//   attempts < 3 → UPDATE attempts+1 + status='running' và chạy lại; ngược lại skip.
//   Restart recovery = hệ quả của unique index.
// - interval: bucket = UTC `yyyymmddThhmm` truncated theo everyMinutes; due check chạy trên
//   bucket HOÀN THÀNH gần nhất (currentBucketStart − size). V1 cardio: mọi bucket được
//   đánh giá trễ tối đa 1 bucket so với giờ bucket — chấp nhận, documented.
// - daily: bucket = server-local `yyyymmdd`; due khi local time ≥ at ("HH:MM").
// - manual: KHÔNG auto-run; chỉ qua POST route; bucket `manual-yyyymmddThhmm` (prefix
//   để không đụng interval bucket cùng phút).
// - event: RESERVED — KHÔNG implement ở V1. Telemetry chưa có bus topic; khi WS path được
//   wire, event-driven sẽ subscribe telemetry/change_events. RoutineDefinition union member
//   giữ nguyên trong types.ts, scheduler skip mọi routine kind lạ.
// - Watermark clinical_state `sky-cardio.last_observed_at:<astronautId>`: max observed_at
//   đã phân tích — INFORMATIVE ONLY, không dùng để gate. clinical_state giữ cho specialists
//   tương lai.
// - Cooldown nằm ở findings.ts (isInCooldown); engine chỉ đọc kết quả và ghi
//   routine_runs status 'cooldown'. Escalation không bao giờ bị suppress.
// - Handler throw → routine_runs status='failed', detail truncated 300 chars; attempts đã
//   được tăng tại claim time (≤3). KHÔNG bao giờ throw ra khỏi timer.

import { and, desc, eq } from "drizzle-orm";
import { astronautsRepo } from "../db/repositories/astronauts";
import { clinicalDb } from "../db/clinicalClient";
import { routineRuns, clinicalState } from "../db/schema/clinical";
import { MEDICAL_AGENTS, routineIdOf } from "./agents";
import {
  analyzeAstronautCardio,
  buildCardioEvidence,
  cardioSummary,
} from "./cardio";
import { isInCooldown, findingsService } from "./findings";
import type { MedicalAgentDefinition, RoutineDefinition, RoutineRunStatus, Severity } from "./types";

// Fictional crew — nguồn: src/db/repositories/astronauts.ts (seed). Fallback khi DB rỗng
// (test) để scheduler không bao giờ chạy 0 astronaut vì lý do tai nạn.
const CREW_FALLBACK = [
  "ayla-reyes",
  "dae-jung-park",
  "lena-fischer",
  "tomas-ortega",
  "yuki-tanaka",
  "noor-abbasi",
];

const DETAIL_MAX = 300;
const MAX_ATTEMPTS = 3;

export async function crewIds(): Promise<string[]> {
  try {
    const rows = await astronautsRepo.list();
    const ids = rows.map((r) => r.id);
    return ids.length > 0 ? ids : CREW_FALLBACK;
  } catch {
    return CREW_FALLBACK;
  }
}

/** UTC `yyyymmddThhmm` cho một timestamp (ms). */
export function formatBucketUtc(ms: number): string {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

/** Bucket interval DUY NHẤT có thể due tại `now`: bucket HOÀN THÀNH gần nhất. */
export function intervalDueBucket(nowMs: number, everyMinutes: number): string {
  const size = everyMinutes * 60_000;
  const currentStart = Math.floor(nowMs / size) * size;
  return formatBucketUtc(currentStart - size);
}

/** Server-local `yyyymmdd` + at="HH:MM" đã tới chưa → bucket hoặc null. */
export function dailyDueBucket(now: Date, at: string): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(at);
  if (!m) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  if (now.getHours() * 60 + now.getMinutes() < Number(m[1]) * 60 + Number(m[2])) return null;
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
}

/** Manual bucket: current minute UTC, prefix chống đụng interval bucket. */
export function manualBucket(nowMs: number): string {
  return `manual-${formatBucketUtc(Math.floor(nowMs / 60_000) * 60_000)}`;
}

export type ClaimResult =
  | { claimed: true; attempts: number }
  | { claimed: false; existingStatus: string };

/** Claim atomique qua UNIQUE index. Retry khi row cũ failed và attempts < 3. */
export function claimRoutineRun(routineId: string, astronautId: string, bucket: string, nowMs: number): ClaimResult {
  try {
    clinicalDb
      .insert(routineRuns)
      .values({ routineId, astronautId, bucket, status: "running", attempts: 1, startedAt: nowMs })
      .run();
    return { claimed: true, attempts: 1 };
  } catch (err) {
    if (!String(err).includes("UNIQUE")) throw err;
    const row = clinicalDb
      .select()
      .from(routineRuns)
      .where(and(eq(routineRuns.routineId, routineId), eq(routineRuns.astronautId, astronautId), eq(routineRuns.bucket, bucket)))
      .all()[0];
    if (!row) throw err;
    if (row.status === "failed" && row.attempts < MAX_ATTEMPTS) {
      clinicalDb
        .update(routineRuns)
        .set({ status: "running", attempts: row.attempts + 1, startedAt: nowMs, finishedAt: null, detail: null })
        .where(eq(routineRuns.id, row.id))
        .run();
      return { claimed: true, attempts: row.attempts + 1 };
    }
    return { claimed: false, existingStatus: row.status };
  }
}

function markRun(routineId: string, astronautId: string, bucket: string, status: RoutineRunStatus, detail?: string): void {
  clinicalDb
    .update(routineRuns)
    .set({ status, detail: detail ? detail.slice(0, DETAIL_MAX) : null, finishedAt: Date.now() })
    .where(and(eq(routineRuns.routineId, routineId), eq(routineRuns.astronautId, astronautId), eq(routineRuns.bucket, bucket)))
    .run();
}

function setWatermark(astronautId: string, observedAt: string): void {
  try {
    clinicalDb
      .insert(clinicalState)
      .values({ key: `sky-cardio.last_observed_at:${astronautId}`, value: observedAt })
      .onConflictDoUpdate({ target: clinicalState.key, set: { value: observedAt } })
      .run();
  } catch (err) {
    console.error("[clinical] watermark write failed", err); // informative only — never fatal
  }
}

export interface RoutineRunResult {
  astronautId: string;
  status: RoutineRunStatus | "skipped";
  findingId?: string;
}

/** Chạy MỘT routine cho MỘT astronaut trong bucket đã claim. Không throw ra ngoài. */
export function executeCardioRoutine(agent: MedicalAgentDefinition, astronautId: string, routineId: string, bucket: string, now: Date): RoutineRunResult {
  try {
    const analysis = analyzeAstronautCardio(astronautId, now);
    if (!analysis.quality.ok) {
      markRun(routineId, astronautId, bucket, "skipped_quality", `quality gate: ${analysis.quality.reason}`);
      return { astronautId, status: "skipped_quality" };
    }
    const detection = analysis.detection!;
    const validSamples = analysis.validSamples;
    const observedAt = validSamples[validSamples.length - 1]?.observedAt ?? now.toISOString();
    setWatermark(astronautId, observedAt);

    if (detection.severity === "green") {
      markRun(routineId, astronautId, bucket, "ok", "green — no finding");
      return { astronautId, status: "ok" };
    }

    if (isInCooldown(astronautId, agent.id, detection.severity)) {
      markRun(routineId, astronautId, bucket, "cooldown", `suppressed: severity ${detection.severity} within cooldown`);
      return { astronautId, status: "cooldown" };
    }

    const evidence = buildCardioEvidence(
      validSamples,
      detection,
      analysis.quality.degradedOrMissingCount > 0 ? "degraded" : "valid",
    );
    const finding = findingsService.create({
      astronautId,
      specialistId: agent.id,
      observedAt,
      metricIds: agent.metrics,
      severity: detection.severity,
      summary: cardioSummary(detection.severity),
      evidence,
    });
    markRun(routineId, astronautId, bucket, "ok", `finding:${finding.id}`);
    return { astronautId, status: "ok", findingId: finding.id };
  } catch (err) {
    const detail = String(err instanceof Error ? err.message : err).slice(0, DETAIL_MAX);
    try {
      markRun(routineId, astronautId, bucket, "failed", detail);
    } catch (inner) {
      console.error("[clinical] markRun(failed) failed", inner);
    }
    console.error("[clinical] routine failed", routineId, astronautId, err);
    return { astronautId, status: "failed" };
  }
}

/** Due-check + claim + execute cho một (agent, routine, astronaut). Trả null khi không due/conflict. */
export function runRoutineIfDue(agent: MedicalAgentDefinition, routine: RoutineDefinition, astronautId: string, now: Date): RoutineRunResult | null {
  const nowMs = now.getTime();
  let bucket: string | null = null;
  const routineId = routineIdOf(agent.id, routine.kind);
  if (routine.kind === "interval") {
    bucket = intervalDueBucket(nowMs, routine.everyMinutes);
  } else if (routine.kind === "daily") {
    bucket = dailyDueBucket(now, routine.at);
  } else {
    return null; // manual chỉ qua route; event RESERVED — không implement V1
  }
  if (!bucket) return null;
  const claim = claimRoutineRun(routineId, astronautId, bucket, nowMs);
  if (!claim.claimed) return null; // đã chạy / đang chạy / cooldown / ok — idempotency
  return executeCardioRoutine(agent, astronautId, routineId, bucket, now);
}

/**
 * Forced/manual run cho BẤT KỲ routine id nào (vd `sky-cardio:manual`, `sky-cardio:interval`).
 * bucket = phút hiện tại UTC với prefix `manual-` (không đụng interval bucket).
 * Cooldown vẫn áp dụng. Trả null khi routine id không tồn tại.
 */
export function runManualRoutine(routineId: string, astronautIds: string[], now: Date): RoutineRunResult[] | null {
  let found: { agent: MedicalAgentDefinition } | null = null;
  for (const agent of MEDICAL_AGENTS) {
    for (const routine of agent.routines) {
      if (routineIdOf(agent.id, routine.kind) === routineId) found = { agent };
    }
  }
  if (!found) return null;
  const { agent } = found;
  const nowMs = now.getTime();
  const bucket = manualBucket(nowMs);
  const results: RoutineRunResult[] = [];
  for (const astronautId of astronautIds) {
    const claim = claimRoutineRun(routineId, astronautId, bucket, nowMs);
    if (!claim.claimed) {
      results.push({ astronautId, status: claim.existingStatus as RoutineRunStatus });
      continue;
    }
    results.push(executeCardioRoutine(agent, astronautId, routineId, bucket, now));
  }
  return results;
}

/** Một tick: chạy mọi routine due cho mọi crew. KHÔNG throw. */
export async function runDueRoutines(now: Date = new Date()): Promise<void> {
  const crew = await crewIds();
  for (const agent of MEDICAL_AGENTS) {
    for (const routine of agent.routines) {
      for (const astronautId of crew) {
        try {
          runRoutineIfDue(agent, routine, astronautId, now);
        } catch (err) {
          console.error(`[clinical] routine ${agent.id}:${routine.kind} failed for ${astronautId}`, err);
        }
      }
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startClinicalScheduler(): void {
  if (process.env.CLINICAL_DISABLED === "1") {
    console.log("[clinical] scheduler disabled (CLINICAL_DISABLED=1)");
    return;
  }
  const sec = Number(process.env.CLINICAL_TICK_SECONDS ?? 30);
  const everyMs = Number.isFinite(sec) && sec > 0 ? Math.floor(sec * 1000) : 30_000;
  if (timer) return;
  timer = setInterval(() => {
    runDueRoutines().catch((err) => console.error("[clinical] tick failed", err));
  }, everyMs);
  timer.unref?.();
  console.log(`[clinical] scheduler tick every ${Math.round(everyMs / 1000)}s`);
}

/** Test hook — dừng timer nếu đang chạy. */
export function stopClinicalScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** lastRuns cho GET /api/clinical/routines: dòng mới nhất mỗi (routine, astronaut). */
export function lastRunsFor(routineId: string, astronautIds: string[]): { astronautId: string | null; bucket: string; status: string; finishedAt: string | null }[] {
  const out: { astronautId: string | null; bucket: string; status: string; finishedAt: string | null }[] = [];
  for (const astronautId of astronautIds) {
    const row = clinicalDb
      .select()
      .from(routineRuns)
      .where(and(eq(routineRuns.routineId, routineId), eq(routineRuns.astronautId, astronautId)))
      .orderBy(desc(routineRuns.id))
      .limit(1)
      .all()[0];
    if (row) {
      out.push({
        astronautId: row.astronautId ?? null,
        bucket: row.bucket,
        status: row.status,
        finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : null,
      });
    }
  }
  return out;
}
