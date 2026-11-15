import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HealthFact, HealthQuality, RuleInput, RuleMetricSample } from "../src/health/rules";

const dir = mkdtempSync(join(tmpdir(), "sky-health-rules-test-"));
process.env.SKY_DB_PATH = join(dir, "rules-singleton.db");

type RulesModule = typeof import("../src/health/rules");
type LiveRepoModule = typeof import("../src/db/repositories/healthLive");

let HealthRulesEngine: RulesModule["HealthRulesEngine"];
let MISSION_SCOPE: LiveRepoModule["MISSION_SCOPE"];

beforeAll(async () => {
  ({ HealthRulesEngine } = await import("../src/health/rules"));
  ({ MISSION_SCOPE } = await import("../src/db/repositories/healthLive"));
});

afterAll(() => {
  delete process.env.SKY_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

// PR4 — rules deterministic: fire, hysteresis, cooldown, dedupe, auto-resolve, rate limit.
// Mọi ngưỡng là ILLUSTRATIVE SIMULATOR TUNING (xem header src/health/rules.ts).

const T0 = Date.UTC(2026, 10, 15, 6, 0, 0);

type MetricInput = number | RuleMetricSample;

function sample(value: MetricInput): RuleMetricSample {
  return typeof value === "number" ? { value, quality: "valid" as HealthQuality } : value;
}

function input(
  subject: string,
  tsMs: number,
  metrics: Record<string, MetricInput>,
  opts: { eventIds?: string[]; skipCardiovascular?: boolean } = {},
): RuleInput {
  const mapped: Record<string, RuleMetricSample> = {};
  for (const [key, value] of Object.entries(metrics)) mapped[key] = sample(value);
  return {
    subject,
    tsMs,
    metrics: mapped,
    eventIds: opts.eventIds ?? [`ev-${subject}-${tsMs}`],
    skipCardiovascular: opts.skipCardiovascular,
  };
}

/** Wall clock điều khiển được cho rate-limit (3 phút wall). */
function makeRules(overrides: ConstructorParameters<typeof HealthRulesEngine>[0] = {}) {
  const clock = { wall: 1_000_000 };
  const rules = new HealthRulesEngine({ now: () => clock.wall, ...overrides });
  return { rules, clock };
}

function feed(
  rules: HealthRulesEngine,
  subject: string,
  fromMs: number,
  seconds: number,
  metrics: Record<string, MetricInput>,
  opts: { eventIds?: string[]; skipCardiovascular?: boolean } = {},
): { facts: HealthFact[]; nextMs: number } {
  const facts: HealthFact[] = [];
  let ts = fromMs;
  for (let i = 0; i < seconds; i += 1) {
    facts.push(...rules.observe(input(subject, ts, metrics, opts)));
    ts += 1000;
  }
  return { facts, nextMs: ts };
}

const hr = (value: number, quality: HealthQuality = "valid") => ({ heart_rate_bpm: { value, quality } });

describe("cardiovascular_anomaly", () => {
  test("fires only after 120 s sustained above baseline + 10 bpm", () => {
    const { rules } = makeRules();
    const base = feed(rules, "ayla-reyes", T0, 200, hr(68));
    expect(base.facts).toEqual([]);

    const elevated = feed(rules, "ayla-reyes", base.nextMs, 130, hr(92));
    const active = elevated.facts.filter((fact) => fact.status === "active");
    expect(active.length).toBe(1);
    expect(active[0].rule).toBe("cardiovascular_anomaly");
    expect(active[0].category).toBe("cardiovascular");
    expect(active[0].crewId).toBe("ayla-reyes");
    expect(active[0].severity).toBe("yellow");
    expect(active[0].quality).toBe("valid");
    expect(active[0].sourceMode).toBe("synthetic");
    expect(active[0].evidenceEventIds.length).toBeLessThanOrEqual(8);
    expect(active[0].observedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Không fire trước 120 s: fact xuất hiện ở sample thứ 121 (0-based 120).
    expect(active[0].factId).toContain("cardiovascular_anomaly:ayla-reyes");
  });

  test("hysteresis: clear needs ≤ baseline + 6 held for 90 s, not a single sample", () => {
    const { rules, clock } = makeRules();
    const base = feed(rules, "ayla-reyes", T0, 200, hr(68));
    const elevated = feed(rules, "ayla-reyes", base.nextMs, 130, hr(92));
    expect(elevated.facts.filter((f) => f.status === "active").length).toBe(1);

    // 80 bpm vẫn trên baseline+6 (74) ⇒ không clear, không resolved.
    const stillHigh = feed(rules, "ayla-reyes", elevated.nextMs, 30, hr(80));
    expect(stillHigh.facts).toEqual([]);

    // 72 bpm ≤ 74 ⇒ clear; resolved chỉ sau 90 s giữ clear.
    clock.wall += 200_000; // ra khỏi rate-limit 3 phút wall
    const clearing = feed(rules, "ayla-reyes", stillHigh.nextMs, 89, hr(72));
    expect(clearing.facts).toEqual([]);
    const resolved = feed(rules, "ayla-reyes", clearing.nextMs, 2, hr(72));
    expect(resolved.facts.length).toBe(1);
    expect(resolved.facts[0].status).toBe("resolved");
    expect(resolved.facts[0].rule).toBe("cardiovascular_anomaly");
  });

  test("dedupe: no repeated active fact while the episode stays active", () => {
    const { rules } = makeRules();
    const base = feed(rules, "ayla-reyes", T0, 200, hr(68));
    const elevated = feed(rules, "ayla-reyes", base.nextMs, 200, hr(92));
    const active = elevated.facts.filter((f) => f.status === "active");
    expect(active.length).toBe(1);
    expect(elevated.facts.filter((f) => f.status === "active").length).toBe(1);
    expect(rules.episodesSnapshot().filter((ep) => ep.active).length).toBe(1);
  });

  test("cooldown 10 min sim after resolve before it can fire again", () => {
    const { rules, clock } = makeRules();
    const base = feed(rules, "ayla-reyes", T0, 200, hr(68));
    const elevated = feed(rules, "ayla-reyes", base.nextMs, 130, hr(92));
    const resolveAt = elevated.nextMs;
    clock.wall += 200_000;
    const cleared = feed(rules, "ayla-reyes", resolveAt, 120, hr(72));
    expect(cleared.facts.filter((f) => f.status === "resolved").length).toBe(1);
    const resolvedMs = cleared.nextMs;

    // Trong cooldown: HR cao lại 130 s (đủ sustain) nhưng KHÔNG fire.
    clock.wall += 200_000;
    const duringCooldown = feed(rules, "ayla-reyes", resolvedMs, 130, hr(92));
    expect(duringCooldown.facts.filter((f) => f.status === "active").length).toBe(0);

    // Chờ hết cooldown (10 phút sim) + window sạch, rồi cao lại ⇒ fire.
    const wait = feed(rules, "ayla-reyes", duringCooldown.nextMs, 500, hr(68));
    expect(wait.facts.filter((f) => f.status === "active").length).toBe(0);
    clock.wall += 200_000;
    const again = feed(rules, "ayla-reyes", wait.nextMs, 130, hr(92));
    expect(again.facts.filter((f) => f.status === "active").length).toBe(1);
  });

  test("rate limit: max 1 publish per 3 minutes wall", () => {
    const { rules } = makeRules();
    const base = feed(rules, "ayla-reyes", T0, 200, hr(68));
    const elevated = feed(rules, "ayla-reyes", base.nextMs, 130, hr(92));
    expect(elevated.facts.length).toBe(1);

    // Clear đủ 90 s nhưng wall clock chưa qua 3 phút ⇒ resolved bị chặn.
    const blocked = feed(rules, "ayla-reyes", elevated.nextMs, 120, hr(72));
    expect(blocked.facts).toEqual([]);
    expect(rules.episodesSnapshot()[0].active).toBe(true);
  });

  test("exercise scenario for that crew skips the rule", () => {
    const { rules } = makeRules();
    const base = feed(rules, "ayla-reyes", T0, 200, hr(68));
    const elevated = feed(rules, "ayla-reyes", base.nextMs, 200, hr(142), { skipCardiovascular: true });
    expect(elevated.facts).toEqual([]);
  });

  test("quality gate: invalid readings never produce a fact", () => {
    const { rules } = makeRules();
    const base = feed(rules, "ayla-reyes", T0, 200, hr(68));
    const elevated = feed(rules, "ayla-reyes", base.nextMs, 130, hr(92, "invalid"));
    expect(elevated.facts).toEqual([]);
  });

  test("suspect readings still produce the fact, tagged suspect", () => {
    const { rules } = makeRules();
    const base = feed(rules, "ayla-reyes", T0, 200, hr(68));
    const elevated = feed(rules, "ayla-reyes", base.nextMs, 130, hr(92, "suspect"));
    const active = elevated.facts.filter((f) => f.status === "active");
    expect(active.length).toBe(1);
    expect(active[0].quality).toBe("suspect");
  });
});

describe("respiratory_distress", () => {
  test("RR above baseline + 4 sustained 60 s fires; clear needs RR back and SpO₂ ≥ 96", () => {
    const { rules, clock } = makeRules();
    const base = feed(rules, "dae-jung-park", T0, 120, { respiratory_rate_bpm: 14, spo2_pct: 98 });
    const elevated = feed(rules, "dae-jung-park", base.nextMs, 70, { respiratory_rate_bpm: 19, spo2_pct: 97 });
    const active = elevated.facts.filter((f) => f.status === "active");
    expect(active.length).toBe(1);
    expect(active[0].rule).toBe("respiratory_distress");
    expect(active[0].category).toBe("respiratory");

    clock.wall += 200_000;
    const clearing = feed(rules, "dae-jung-park", elevated.nextMs, 100, { respiratory_rate_bpm: 15, spo2_pct: 96 });
    const resolved = clearing.facts.filter((f) => f.status === "resolved");
    expect(resolved.length).toBe(1);
    expect(resolved[0].rule).toBe("respiratory_distress");
  });

  test("SpO₂ < 95 alone fires after 60 s", () => {
    const { rules } = makeRules();
    const base = feed(rules, "noor-abbasi", T0, 120, { respiratory_rate_bpm: 14, spo2_pct: 98 });
    const low = feed(rules, "noor-abbasi", base.nextMs, 70, { respiratory_rate_bpm: 14, spo2_pct: 93 });
    expect(low.facts.filter((f) => f.status === "active" && f.rule === "respiratory_distress").length).toBe(1);
  });
});

describe("radiation_burst (mission scope)", () => {
  test("3× median + >2 µSv/h fires yellow; <1.5× for 90 s resolves", () => {
    const { rules, clock } = makeRules();
    const base = feed(rules, MISSION_SCOPE, T0, 200, { dose_rate_uSv_h: 1.0 });
    const burst = feed(rules, MISSION_SCOPE, base.nextMs, 70, { dose_rate_uSv_h: 3.5 });
    const active = burst.facts.filter((f) => f.status === "active");
    expect(active.length).toBe(1);
    expect(active[0].rule).toBe("radiation_burst");
    expect(active[0].category).toBe("radiation");
    expect(active[0].crewId).toBeUndefined();
    expect(active[0].severity).toBe("yellow");

    clock.wall += 200_000;
    const clearing = feed(rules, MISSION_SCOPE, burst.nextMs, 100, { dose_rate_uSv_h: 1.0 });
    const resolved = clearing.facts.filter((f) => f.status === "resolved");
    expect(resolved.length).toBe(1);
    expect(resolved[0].rule).toBe("radiation_burst");
  });

  test("≥4× median escalates to red", () => {
    const { rules } = makeRules();
    const base = feed(rules, MISSION_SCOPE, T0, 200, { dose_rate_uSv_h: 1.0 });
    const burst = feed(rules, MISSION_SCOPE, base.nextMs, 70, { dose_rate_uSv_h: 5.0 });
    const active = burst.facts.filter((f) => f.status === "active");
    expect(active.length).toBe(1);
    expect(active[0].severity).toBe("red");
  });

  test("below the absolute floor (2 µSv/h) never fires even if 3× median", () => {
    const { rules } = makeRules();
    const base = feed(rules, MISSION_SCOPE, T0, 200, { dose_rate_uSv_h: 0.4 });
    const small = feed(rules, MISSION_SCOPE, base.nextMs, 200, { dose_rate_uSv_h: 1.5 });
    expect(small.facts).toEqual([]);
  });
});

describe("environment rules", () => {
  test("CO₂ > 2000 ppm sustained 120 s fires; <1700 ppm for 120 s resolves", () => {
    const { rules, clock } = makeRules();
    const base = feed(rules, MISSION_SCOPE, T0, 60, { co2_ppm: 850 });
    const high = feed(rules, MISSION_SCOPE, base.nextMs, 130, { co2_ppm: 2400 });
    const active = high.facts.filter((f) => f.status === "active");
    expect(active.length).toBe(1);
    expect(active[0].rule).toBe("environment_co2_elevated");
    expect(active[0].category).toBe("environment");

    clock.wall += 200_000;
    const clearing = feed(rules, MISSION_SCOPE, high.nextMs, 130, { co2_ppm: 1600 });
    expect(clearing.facts.filter((f) => f.status === "resolved").length).toBe(1);
  });

  test("O₂ < 19.5 % sustained 120 s fires yellow; < 18.5 % is red", () => {
    const { rules } = makeRules();
    const base = feed(rules, MISSION_SCOPE, T0, 60, { o2_pct: 20.9 });
    const low = feed(rules, MISSION_SCOPE, base.nextMs, 130, { o2_pct: 19.2 });
    const active = low.facts.filter((f) => f.status === "active");
    expect(active.length).toBe(1);
    expect(active[0].rule).toBe("environment_o2_low");
    expect(active[0].severity).toBe("yellow");

    const red = makeRules();
    const redBase = feed(red.rules, MISSION_SCOPE, T0, 60, { o2_pct: 20.9 });
    const critical = feed(red.rules, MISSION_SCOPE, redBase.nextMs, 130, { o2_pct: 18.4 });
    const redActive = critical.facts.filter((f) => f.status === "active");
    expect(redActive.length).toBe(1);
    expect(redActive[0].severity).toBe("red");
  });

  test("O₂ recovers only at ≥ 20.0 % for 120 s (hysteresis band 19.5–20.0 holds the fact)", () => {
    const { rules, clock } = makeRules();
    const base = feed(rules, MISSION_SCOPE, T0, 60, { o2_pct: 20.9 });
    const low = feed(rules, MISSION_SCOPE, base.nextMs, 130, { o2_pct: 19.2 });
    expect(low.facts.filter((f) => f.status === "active").length).toBe(1);

    clock.wall += 200_000;
    const between = feed(rules, MISSION_SCOPE, low.nextMs, 130, { o2_pct: 19.8 });
    expect(between.facts.filter((f) => f.status === "resolved").length).toBe(0);
    const recovered = feed(rules, MISSION_SCOPE, between.nextMs, 121, { o2_pct: 20.4 });
    expect(recovered.facts.filter((f) => f.status === "resolved").length).toBe(1);
  });
});

describe("auto-resolve when telemetry goes silent", () => {
  test("active fact resolves once the trailing window has no supporting samples", () => {
    const { rules, clock } = makeRules({ windowMs: 60_000 });
    const base = feed(rules, "tomas-ortega", T0, 100, { respiratory_rate_bpm: 14, spo2_pct: 98 });
    const low = feed(rules, "tomas-ortega", base.nextMs, 70, { respiratory_rate_bpm: 14, spo2_pct: 92 });
    expect(low.facts.filter((f) => f.status === "active").length).toBe(1);
    clock.wall += 200_000;
    // Không còn sample nào cho 180 s sim ⇒ sweepStale resolve.
    const silent = rules.observe(input("ayla-reyes", low.nextMs + 180_000, { heart_rate_bpm: 68 }));
    expect(silent.filter((f) => f.status === "resolved" && f.rule === "respiratory_distress").length).toBe(1);
  });
});
