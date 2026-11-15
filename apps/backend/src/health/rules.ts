// Deterministic health rules (SPEC §14 v2, PR4) — ILLUSTRATIVE SIMULATOR TUNING.
//
// MỌI hằng số dưới đây là tham số mô phỏng minh hoạ, KHÔNG phải ngưỡng lâm sàng, không phải
// hướng dẫn y khoa. Chúng chỉ tạo "facts" từ dữ liệu synthetic để agent có ngữ cảnh.
// Nguồn tham chiếu bối cảnh (không phải threshold):
//   - HR/RR/SpO₂: NASA HRP Evidence Reports https://humanresearchroadmap.nasa.gov/evidencereports
//   - Cabin O₂/CO₂: NASA-STD-3001 Vol 2 https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02
//   - Bức xạ (dose rate): NASA SRAG https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm
//   - Tim khi vi trọng lực (baseline drift): https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665
//
// Nguyên tắc: deterministic (không LLM, không random), hysteresis bắt buộc, episode
// active → resolved, dedupe khi đang active, cooldown sau resolve. AI không quyết định gì ở đây —
// fact chỉ là dữ kiện; hành động y khoa vẫn cần phi hành gia xác nhận.

import type { HealthQuality } from "../db/repositories/healthLive";
import { MISSION_SCOPE } from "../db/repositories/healthLive";

export type RuleCategory = "cardiovascular" | "respiratory" | "radiation" | "environment";

export const HEALTH_RULE_IDS = [
  "cardiovascular_anomaly",
  "respiratory_distress",
  "radiation_burst",
  "environment_co2_elevated",
  "environment_o2_low",
] as const;
export type HealthRuleId = (typeof HEALTH_RULE_IDS)[number];

export type FactSeverity = "info" | "yellow" | "red";
export type FactStatus = "active" | "resolved";

/** Payload `health.fact.updated` (SPEC §14) — facts, KHÔNG raw readings. */
export interface HealthFact {
  factId: string;
  missionId: string;
  crewId?: string;
  category: RuleCategory;
  rule: HealthRuleId;
  status: FactStatus;
  severity: FactSeverity;
  sourceMode: "synthetic";
  quality: HealthQuality;
  /** observed_at theo sim clock (UTC ISO-8601). */
  observedAt: string;
  /** Tối đa 8 event id gần nhất hỗ trợ fact (KHÔNG mang payload thô). */
  evidenceEventIds: string[];
  /** Một dòng người đọc được — vào cột `change_events.summary`, KHÔNG vào payload. */
  summary: string;
}

export interface RuleMetricSample {
  value: number;
  quality: HealthQuality;
}

export interface RuleInput {
  /** astronautId hoặc `MISSION` (metric cabin/mission-scoped). */
  subject: string;
  /** Sim time (epoch ms) của frame telemetry. */
  tsMs: number;
  metrics: Record<string, RuleMetricSample>;
  eventIds: string[];
  /** Crew đang trong scenario exercise → bỏ qua cardiovascular (HR 140 là target tập, không phải anomaly). */
  skipCardiovascular?: boolean;
}

// --- Tuning (illustrative) ---
const WINDOW_MS = 600_000; // trailing 10 phút sim
const HR_DELTA_FIRE = 10; // bpm trên median của window
const HR_DELTA_CLEAR = 6; // hysteresis: phải về ≤ baseline + 6 mới clear
const HR_SUSTAIN_MS = 120_000;
const RR_DELTA_FIRE = 4;
const RR_DELTA_CLEAR = 2;
const SPO2_FIRE = 95; // %
const SPO2_CLEAR = 96; // %
const RR_SUSTAIN_MS = 60_000;
const RAD_FIRE_FACTOR = 3; // × mission median
const RAD_FIRE_ABS = 2; // µSv/h — illustrative, không phải giới hạn phơi nhiễm
const RAD_CLEAR_FACTOR = 1.5;
const RAD_SUSTAIN_MS = 60_000;
const RAD_CLEAR_HOLD_MS = 90_000;
const RAD_RED_FACTOR = 4;
const CO2_FIRE = 2000; // ppm — tuning demo (target scenario ~2500, xem SPEC §6.2)
const CO2_CLEAR = 1700;
const CO2_SUSTAIN_MS = 120_000;
const CO2_CLEAR_HOLD_MS = 120_000;
const O2_FIRE = 19.5; // %
const O2_CLEAR = 20.0;
const O2_RED = 18.5;
const O2_SUSTAIN_MS = 120_000;
const O2_CLEAR_HOLD_MS = 120_000;
const DEFAULT_CLEAR_HOLD_MS = 90_000;
const COOLDOWN_MS = 600_000; // 10 phút sim sau resolve trước khi được fire lại
const RATE_LIMIT_MS = 180_000; // 3 phút WALL — tối đa 1 publish / rule / subject

const EVIDENCE_MAX = 8;

interface TrailEntry {
  ts: number;
  value: number;
  quality: HealthQuality;
}

interface Episode {
  rule: HealthRuleId;
  category: RuleCategory;
  subject: string;
  active: boolean;
  conditionSinceMs: number | null;
  clearSinceMs: number | null;
  startedAtMs: number | null;
  factId: string | null;
  severity: FactSeverity;
  evidence: string[];
  lastSeenMs: number | null;
  suppressUntilMs: number | null;
  pendingActive: boolean;
  lastPublishedWallMs: number | null;
}

const QUALITY_RANK: Record<HealthQuality, number> = { valid: 0, suspect: 1, invalid: 2 };

function worstQuality(values: HealthQuality[]): HealthQuality {
  let worst: HealthQuality = "valid";
  for (const value of values) if (QUALITY_RANK[value] > QUALITY_RANK[worst]) worst = value;
  return worst;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface HealthRulesOptions {
  missionId?: string;
  /** Wall clock cho rate-limit (test inject mốc cố định). */
  now?: () => number;
  /** Default 3 phút wall — xem RATE_LIMIT_MS. */
  rateLimitMs?: number;
  /** Default 10 phút sim. */
  cooldownMs?: number;
  windowMs?: number;
}

export class HealthRulesEngine {
  private readonly missionId: string;
  private readonly now: () => number;
  private readonly rateLimitMs: number;
  private readonly cooldownMs: number;
  private readonly windowMs: number;
  private readonly trails = new Map<string, TrailEntry[]>();
  private readonly episodes = new Map<string, Episode>();

  constructor(options: HealthRulesOptions = {}) {
    this.missionId = options.missionId ?? "SIM-001";
    this.now = options.now ?? (() => Date.now());
    this.rateLimitMs = options.rateLimitMs ?? RATE_LIMIT_MS;
    this.cooldownMs = options.cooldownMs ?? COOLDOWN_MS;
    this.windowMs = options.windowMs ?? WINDOW_MS;
  }

  /** Đánh giá mọi rule cho một frame telemetry; trả các fact CẦN publish (đã lọc dedupe/rate-limit). */
  observe(input: RuleInput): HealthFact[] {
    const facts: HealthFact[] = [];
    if (input.subject !== MISSION_SCOPE) {
      const cardio = this.cardiovascular(input);
      if (cardio) facts.push(cardio);
      const respiratory = this.respiratory(input);
      if (respiratory) facts.push(respiratory);
    } else {
      const radiation = this.radiation(input);
      if (radiation) facts.push(radiation);
      const co2 = this.co2(input);
      if (co2) facts.push(co2);
      const o2 = this.o2(input);
      if (o2) facts.push(o2);
    }
    facts.push(...this.sweepStale(input.tsMs));
    return facts;
  }

  /** Snapshot episode state — test hysteresis/dedupe không cần đọc DB. */
  episodesSnapshot(): Array<{
    rule: HealthRuleId;
    subject: string;
    active: boolean;
    severity: FactSeverity;
    factId: string | null;
    suppressUntilMs: number | null;
  }> {
    return [...this.episodes.values()].map((ep) => ({
      rule: ep.rule,
      subject: ep.subject,
      active: ep.active,
      severity: ep.severity,
      factId: ep.factId,
      suppressUntilMs: ep.suppressUntilMs,
    }));
  }

  reset(): void {
    this.trails.clear();
    this.episodes.clear();
  }

  // --- signals ---

  private push(subject: string, metric: string, tsMs: number, sample: RuleMetricSample): TrailEntry[] {
    const key = `${subject}|${metric}`;
    const trail = this.trails.get(key) ?? [];
    trail.push({ ts: tsMs, value: sample.value, quality: sample.quality });
    const horizon = tsMs - this.windowMs;
    while (trail.length > 0 && trail[0].ts < horizon) trail.shift();
    this.trails.set(key, trail);
    return trail;
  }

  private trailValues(subject: string, metric: string): TrailEntry[] {
    return this.trails.get(`${subject}|${metric}`) ?? [];
  }

  // --- rules ---

  private cardiovascular(input: RuleInput): HealthFact | null {
    const hr = input.metrics.heart_rate_bpm;
    if (!hr) return null;
    const trail = this.push(input.subject, "heart_rate_bpm", input.tsMs, hr);
    if (input.skipCardiovascular) return null; // exercise target — không phải anomaly
    const baseline = median(trail.map((entry) => entry.value));
    const condition = hr.value > baseline + HR_DELTA_FIRE;
    const cleared = hr.value <= baseline + HR_DELTA_CLEAR;
    return this.advance({
      rule: "cardiovascular_anomaly",
      category: "cardiovascular",
      subject: input.subject,
      tsMs: input.tsMs,
      condition,
      cleared,
      sustainMs: HR_SUSTAIN_MS,
      clearHoldMs: DEFAULT_CLEAR_HOLD_MS,
      severity: "yellow",
      trail,
      evidence: input.eventIds,
      summary:
        `Heart rate ${round1(hr.value)} bpm above the crew trailing median ${round1(baseline)} bpm ` +
        `(+${round1(hr.value - baseline)} bpm) sustained ${Math.round(HR_SUSTAIN_MS / 1000)} s ` +
        `(simulated; illustrative tuning, NASA HRP context)`,
    });
  }

  private respiratory(input: RuleInput): HealthFact | null {
    const rr = input.metrics.respiratory_rate_bpm;
    const spo2 = input.metrics.spo2_pct;
    if (!rr && !spo2) return null;
    if (rr) this.push(input.subject, "respiratory_rate_bpm", input.tsMs, rr);
    if (spo2) this.push(input.subject, "spo2_pct", input.tsMs, spo2);
    const rrBaseline = median(this.trailValues(input.subject, "respiratory_rate_bpm").map((e) => e.value));
    const rrHigh = rr ? rr.value > rrBaseline + RR_DELTA_FIRE : false;
    const spo2Low = spo2 ? spo2.value < SPO2_FIRE : false;
    const condition = rrHigh || spo2Low;
    const rrCleared = rr ? rr.value <= rrBaseline + RR_DELTA_CLEAR : true;
    const spo2Cleared = spo2 ? spo2.value >= SPO2_CLEAR : true;
    // Hysteresis: cả hai escape khỏi trạng thái bất thường mới clear.
    const cleared = rrCleared && spo2Cleared;
    const parts: string[] = [];
    if (rr) parts.push(`RR ${round1(rr.value)}/min vs trailing median ${round1(rrBaseline)}/min`);
    if (spo2) parts.push(`SpO₂ ${round1(spo2.value)}%`);
    return this.advance({
      rule: "respiratory_distress",
      category: "respiratory",
      subject: input.subject,
      tsMs: input.tsMs,
      condition,
      cleared,
      sustainMs: RR_SUSTAIN_MS,
      clearHoldMs: DEFAULT_CLEAR_HOLD_MS,
      severity: "yellow",
      trail: this.trailValues(input.subject, "respiratory_rate_bpm"),
      evidence: input.eventIds,
      summary: `${parts.join(", ")} — sustained ${Math.round(RR_SUSTAIN_MS / 1000)} s (simulated; illustrative tuning)`,
    });
  }

  private radiation(input: RuleInput): HealthFact | null {
    const dose = input.metrics.dose_rate_uSv_h;
    if (!dose) return null;
    const trail = this.push(input.subject, "dose_rate_uSv_h", input.tsMs, dose);
    const baseline = median(trail.map((entry) => entry.value));
    const condition = dose.value > RAD_FIRE_FACTOR * baseline && dose.value > RAD_FIRE_ABS;
    const cleared = dose.value < RAD_CLEAR_FACTOR * baseline;
    const severity: FactSeverity = dose.value >= RAD_RED_FACTOR * baseline ? "red" : "yellow";
    return this.advance({
      rule: "radiation_burst",
      category: "radiation",
      subject: input.subject,
      tsMs: input.tsMs,
      condition,
      cleared,
      sustainMs: RAD_SUSTAIN_MS,
      clearHoldMs: RAD_CLEAR_HOLD_MS,
      severity,
      trail,
      evidence: input.eventIds,
      summary:
        `Dose rate ${round2(dose.value)} µSv/h ≈ ${round1(baseline > 0 ? dose.value / baseline : 0)}× ` +
        `mission trailing median (simulated burst; SRAG context, not an exposure limit)`,
    });
  }

  private co2(input: RuleInput): HealthFact | null {
    const co2 = input.metrics.co2_ppm;
    if (!co2) return null;
    const trail = this.push(input.subject, "co2_ppm", input.tsMs, co2);
    const condition = co2.value > CO2_FIRE;
    const cleared = co2.value < CO2_CLEAR;
    return this.advance({
      rule: "environment_co2_elevated",
      category: "environment",
      subject: input.subject,
      tsMs: input.tsMs,
      condition,
      cleared,
      sustainMs: CO2_SUSTAIN_MS,
      clearHoldMs: CO2_CLEAR_HOLD_MS,
      severity: "yellow",
      trail,
      evidence: input.eventIds,
      summary:
        `Cabin CO₂ ${Math.round(co2.value)} ppm above ${CO2_FIRE} ppm sustained ` +
        `${Math.round(CO2_SUSTAIN_MS / 1000)} s (simulated; NASA-STD-3001 Vol 2 context, not a limit)`,
    });
  }

  private o2(input: RuleInput): HealthFact | null {
    const o2 = input.metrics.o2_pct;
    if (!o2) return null;
    const trail = this.push(input.subject, "o2_pct", input.tsMs, o2);
    const condition = o2.value < O2_FIRE;
    const cleared = o2.value >= O2_CLEAR;
    const severity: FactSeverity = o2.value < O2_RED ? "red" : "yellow";
    return this.advance({
      rule: "environment_o2_low",
      category: "environment",
      subject: input.subject,
      tsMs: input.tsMs,
      condition,
      cleared,
      sustainMs: O2_SUSTAIN_MS,
      clearHoldMs: O2_CLEAR_HOLD_MS,
      severity,
      trail,
      evidence: input.eventIds,
      summary:
        `Cabin O₂ ${round2(o2.value)}% below ${O2_FIRE}% sustained ${Math.round(O2_SUSTAIN_MS / 1000)} s ` +
        `(simulated; NASA-STD-3001 Vol 2 context, not a limit)`,
    });
  }

  // --- episode state machine ---

  private advance(input: {
    rule: HealthRuleId;
    category: RuleCategory;
    subject: string;
    tsMs: number;
    condition: boolean;
    cleared: boolean;
    sustainMs: number;
    clearHoldMs: number;
    severity: FactSeverity;
    trail: TrailEntry[];
    evidence: string[];
    summary: string;
  }): HealthFact | null {
    const key = `${input.rule}|${input.subject}`;
    let ep = this.episodes.get(key);
    if (!ep) {
      ep = {
        rule: input.rule,
        category: input.category,
        subject: input.subject,
        active: false,
        conditionSinceMs: null,
        clearSinceMs: null,
        startedAtMs: null,
        factId: null,
        severity: input.severity,
        evidence: [],
        lastSeenMs: null,
        suppressUntilMs: null,
        pendingActive: false,
        lastPublishedWallMs: null,
      };
      this.episodes.set(key, ep);
    }
    ep.lastSeenMs = input.tsMs;

    if (ep.active) {
      if (!input.cleared) {
        ep.clearSinceMs = null;
        return null;
      }
      if (ep.clearSinceMs === null) ep.clearSinceMs = input.tsMs;
      if (input.tsMs - ep.clearSinceMs < input.clearHoldMs) return null;
      // Resolve: rate-limit vẫn áp dụng (retry ở frame sau, episode giữ active).
      if (this.rateLimited(ep)) return null;
      const clearTrail = input.trail.filter((entry) => ep!.clearSinceMs !== null && entry.ts >= ep!.clearSinceMs);
      const clearQuality = worstQuality(clearTrail.map((entry) => entry.quality));
      return this.resolve(ep, input.tsMs, clearQuality);
    }

    if (!input.condition) {
      ep.conditionSinceMs = null;
      ep.pendingActive = false;
      return null;
    }
    if (ep.conditionSinceMs === null) ep.conditionSinceMs = input.tsMs;
    if (input.tsMs - ep.conditionSinceMs < input.sustainMs) return null;
    // Cooldown sau resolve (sim time) — chưa cho fire lại.
    if (ep.suppressUntilMs !== null && input.tsMs < ep.suppressUntilMs) {
      ep.pendingActive = true;
      return null;
    }
    if (this.rateLimited(ep)) {
      ep.pendingActive = true;
      return null;
    }
    const supporting = input.trail.filter((entry) => ep!.conditionSinceMs !== null && entry.ts >= ep!.conditionSinceMs);
    const quality = worstQuality(supporting.map((entry) => entry.quality));
    // Quality gate: invalid trong supporting window ⇒ không publish fact (sim vẫn chạy tiếp).
    if (quality === "invalid") {
      ep.pendingActive = true;
      return null;
    }

    ep.active = true;
    ep.pendingActive = false;
    ep.startedAtMs = ep.conditionSinceMs;
    ep.severity = input.severity;
    ep.factId = `${input.rule}:${input.subject}:${ep.conditionSinceMs}`;
    ep.evidence = input.evidence.slice(-EVIDENCE_MAX);
    ep.clearSinceMs = null;
    ep.lastPublishedWallMs = this.now();
    return this.fact(ep, "active", input.tsMs, quality, input.summary);
  }

  private resolve(ep: Episode, tsMs: number, quality: HealthQuality = "valid"): HealthFact {
    ep.active = false;
    ep.conditionSinceMs = null;
    ep.clearSinceMs = null;
    ep.suppressUntilMs = tsMs + this.cooldownMs;
    ep.pendingActive = false;
    ep.lastPublishedWallMs = this.now();
    const fact = this.fact(
      ep,
      "resolved",
      tsMs,
      quality,
      `Resolved: ${ep.rule.replaceAll("_", " ")} — values back within hysteresis band (simulated)`,
    );
    ep.factId = null;
    return fact;
  }

  /** Resolve episode đã im lặng quá window (không còn telemetry hỗ trợ) — không để fact treo. */
  private sweepStale(tsMs: number): HealthFact[] {
    const facts: HealthFact[] = [];
    for (const ep of this.episodes.values()) {
      if (!ep.active) continue;
      if (ep.lastSeenMs === null || tsMs - ep.lastSeenMs <= this.windowMs) continue;
      if (this.rateLimited(ep)) continue;
      facts.push(this.resolve(ep, tsMs));
    }
    return facts;
  }

  private rateLimited(ep: Episode): boolean {
    if (ep.lastPublishedWallMs === null) return false;
    return this.now() - ep.lastPublishedWallMs < this.rateLimitMs;
  }

  private fact(
    ep: Episode,
    status: FactStatus,
    tsMs: number,
    quality: HealthQuality,
    summary: string,
  ): HealthFact {
    const factId = ep.factId ?? `${ep.rule}:${ep.subject}:${tsMs}`;
    return {
      factId,
      missionId: this.missionId,
      ...(ep.subject === MISSION_SCOPE ? {} : { crewId: ep.subject }),
      category: ep.category,
      rule: ep.rule,
      status,
      severity: ep.severity,
      sourceMode: "synthetic",
      quality,
      observedAt: new Date(tsMs).toISOString(),
      evidenceEventIds: ep.evidence.slice(-EVIDENCE_MAX),
      summary,
    };
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
