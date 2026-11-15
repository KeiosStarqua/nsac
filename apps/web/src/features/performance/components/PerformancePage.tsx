import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ASTRONAUT_STORAGE_KEY,
  DEFAULT_ASTRONAUT_ID,
  findAstronaut,
} from "../../astronaut";
import { format, useCopy, useLocale } from "../../../shared/i18n";
import { getPerformance } from "../api/health.functions";
import { InsightPanel } from "./InsightPanel";
import { MetricGrid } from "./MetricGrid";
import { selectSkyInsight } from "../model/insight";
import {
  buildMetricTiles,
  formatAsOf,
  insightSeries,
  type Method,
  type MetricId,
  type PerformanceSnapshot,
} from "../model/metrics";

/** Simulated mission clock shown in the header. */
const MISSION_DAY = 170;

const PAGE_BACKDROP =
  "bg-[radial-gradient(120%_85%_at_82%_-12%,rgba(90,78,236,0.20),transparent_56%),radial-gradient(95%_70%_at_-5%_0%,rgba(16,116,148,0.22),transparent_62%),linear-gradient(180deg,#070b14_0%,#060a12_62%,#04070e_100%)]";

const BRAND_RING = [
  "relative grid size-[38px] flex-none place-items-center rounded-full border-2 border-transparent",
  "[background:linear-gradient(#09192c,#09192c)_padding-box,conic-gradient(from_55deg,transparent_8%,#8defff_28%,#a4aaff_50%,#fff_70%,#8ca6ff_82%,transparent_100%)_border-box]",
  "shadow-[0_0_16px_rgba(105,192,255,0.24),inset_0_0_8px_rgba(108,156,255,0.14)]",
].join(" ");

const NAV_LINK_TERTIARY = [
  "inline-flex items-center gap-1.5 self-center rounded-full border border-white/10 bg-transparent",
  "px-2.5 py-1.5 text-[9px] uppercase tracking-[0.18em] text-[#7186ad]! no-underline!",
  "[transition:border-color_.18s,color_.18s]",
  "hover:border-[#8ce7ff] hover:text-[#aee6ff]!",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#f5fcff]!",
].join(" ");

const NAV_LINK = [
  "inline-flex items-center gap-1.5 rounded-full border border-[rgba(122,222,255,0.30)] bg-[rgba(11,36,58,0.45)]",
  "px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#aee6ff]! no-underline!",
  "[transition:border-color_.18s,background_.18s,color_.18s]",
  "hover:border-[#8ce7ff] hover:bg-[rgba(20,62,94,0.5)] hover:text-[#e6fbff]!",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#f5fcff]!",
].join(" ");

interface PerformancePageProps {
  initial: PerformanceSnapshot;
}

/**
 * `/performance` — SKY / Human Performance. A fitness-style face of the same fictional crew:
 * 12 simulated metric tiles, a deterministic Sky insight and a quiet fallback when the backend is
 * not reachable. No 3D, no agent call, no auth.
 */
export function PerformancePage({ initial }: PerformancePageProps) {
  const copy = useCopy();
  const locale = useLocale();
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot>(initial);
  const [astronautId, setAstronautId] = useState(initial.astronautId);

  // The followed astronaut is the HUD pick in localStorage `nsac.astronaut` (fallback Ayla Reyes).
  // SSR renders the default so the page is complete; the client swaps only if the stored pick differs.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ASTRONAUT_STORAGE_KEY);
    } catch {
      stored = null;
    }
    const nextId = findAstronaut(stored)?.id ?? DEFAULT_ASTRONAUT_ID;
    setAstronautId(nextId);
    if (nextId === initial.astronautId) return;
    let alive = true;
    void getPerformance({ data: { astronautId: nextId } })
      .then((result) => {
        if (alive) setSnapshot(result);
      })
      .catch(() => {
        /* keep whatever is on screen — the fixture fallback already renders */
      });
    return () => {
      alive = false;
    };
  }, [initial.astronautId]);

  const astronaut = findAstronaut(astronautId) ?? findAstronaut(DEFAULT_ASTRONAUT_ID)!;

  const metricLabels: Record<MetricId, string> = {
    energy_burned: copy.performance.metricEnergyBurned,
    calories_intake: copy.performance.metricCaloriesIntake,
    energy_balance: copy.performance.metricEnergyBalance,
    muscle_mass: copy.performance.metricMuscleMass,
    muscle_strength: copy.performance.metricMuscleStrength,
    body_fat: copy.performance.metricBodyFat,
    sleep_duration: copy.performance.metricSleepDuration,
    sleep_efficiency: copy.performance.metricSleepEfficiency,
    hrv: copy.performance.metricHrv,
    hydration: copy.performance.metricHydration,
    exercise_duration: copy.performance.metricExerciseDuration,
    heart_rate: copy.performance.metricHeartRate,
  };
  const methodLabels: Record<Method, string> = {
    estimated: copy.performance.methodEstimated,
    measured: copy.performance.methodMeasured,
    self_reported: copy.performance.methodSelfReported,
    simulated: copy.performance.methodSimulated,
  };

  const tiles = buildMetricTiles(snapshot, { metrics: metricLabels, methods: methodLabels }, locale);
  const insight = selectSkyInsight(insightSeries(snapshot));
  const insightText = {
    muscle: copy.performance.insightMuscle,
    sleep: copy.performance.insightSleep,
    hrv: copy.performance.insightHrv,
    hydration: copy.performance.insightHydration,
    steady: copy.performance.insightSteady,
  }[insight.rule];

  const note = snapshot.reachable
    ? format(copy.performance.reachableNote, { asOf: formatAsOf(snapshot.asOf, locale) })
    : copy.performance.fallbackNote;

  return (
    <main
      className={`relative min-h-dvh w-full overflow-x-clip text-(--text) [font-family:Inter,Manrope,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif] [font-synthesis:none] ${PAGE_BACKDROP}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_50%_38%,transparent_55%,rgba(2,6,14,0.55)_100%)]"
      />

      <div className="relative z-[1] mx-auto w-full max-w-[1440px] px-4 pb-9 pt-6 sm:px-7 sm:pt-7 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span aria-hidden="true" className={BRAND_RING}>
              <span className="size-[7px] rounded-full bg-[#8ef0d9] shadow-[0_0_11px_#5eead4]" />
            </span>
            <div>
              <h1 className="m-0! text-[16px] font-light uppercase leading-tight tracking-[0.2em] text-(--text) sm:text-[19px]">
                {copy.performance.brand}
              </h1>
              <p className="mt-1 mb-0! text-[10.5px] uppercase tracking-[0.18em] text-(--muted)">
                {copy.performance.brandSub}
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <p className="m-0! text-[9.5px] uppercase tracking-[0.2em] text-(--muted)">
              {copy.performance.crewHealth} · {format(copy.performance.missionDay, { day: String(MISSION_DAY) })}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 sm:justify-end">
              <span
                aria-hidden="true"
                className="grid size-[30px] place-items-center rounded-full border border-[rgba(122,222,255,0.35)] bg-[linear-gradient(160deg,rgba(31,86,124,0.7),rgba(19,38,68,0.9))] text-[10px] font-medium tracking-[0.08em] text-[#cff3ff]"
              >
                {astronaut.initial}
              </span>
              <span className="text-[14px] font-light text-(--text)">{astronaut.name}</span>
              <span className="rounded-full border border-[rgba(94,234,212,0.28)] bg-[rgba(94,234,212,0.08)] px-2 py-[3px] text-[8.5px] uppercase tracking-[0.16em] text-[rgba(142,240,217,0.9)]">
                {copy.performance.simulatedData}
              </span>
            </div>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,352px)] xl:gap-6">
          <MetricGrid
            tiles={tiles}
            ariaLabel={copy.performance.metricsAria}
            deltaCaption={copy.performance.deltaVs}
            simulatedLabel={copy.performance.simulatedTag}
          />
          <InsightPanel
            title={copy.performance.insightTitle}
            caption={copy.performance.insightCaption}
            text={insightText}
            sourceLabel={copy.performance.insightSource}
            sourceUrl={insight.sourceUrl}
            sourceTitle={insight.sourceTitle}
            methodTitle={copy.performance.methodTitle}
            methodNote={copy.performance.methodNote}
            methods={[
              { key: "measured", label: methodLabels.measured },
              { key: "estimated", label: methodLabels.estimated },
              { key: "self_reported", label: methodLabels.self_reported },
              { key: "simulated", label: methodLabels.simulated },
            ]}
            note={note}
          />
        </div>

        <footer className="mt-8 flex flex-col gap-4 border-t border-white/8 pt-5 text-[11px] text-(--muted) sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0! max-w-[76ch] leading-relaxed">{copy.performance.disclaimer}</p>
          <nav className="flex flex-none flex-wrap gap-2">
            <Link to="/" search={(prev) => prev} className={NAV_LINK}>
              <span aria-hidden="true">←</span>
              {copy.performance.backToHud}
            </Link>
            <Link to="/research" search={(prev) => prev} className={NAV_LINK_TERTIARY}>
              {copy.performance.researchEvidence}
            </Link>
            <Link to="/body" search={(prev) => prev} className={NAV_LINK}>
              {copy.performance.bodyMap}
              <span aria-hidden="true">→</span>
            </Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
