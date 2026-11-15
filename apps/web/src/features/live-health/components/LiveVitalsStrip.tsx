import { format, type Copy } from "~/shared/i18n";
import { formatLiveUpdatedAt, liveStripMode, type LiveHealthState } from "../model/liveHealth";
import { buildLiveStripCards, type LiveStripCard, type LiveStripCardId } from "../model/strip";

/** The strip is the first thing on the page: one quiet glass band, cards inside it. */
const SECTION = [
  "rounded-2xl border border-[rgba(94,234,212,0.16)]",
  "bg-[linear-gradient(158deg,rgba(15,24,44,0.9),rgba(8,15,28,0.82))]",
  "px-3.5 py-3 sm:px-4",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
].join(" ");

const CARD = [
  "min-w-0 rounded-xl border border-[rgba(148,163,184,0.16)]",
  "bg-[rgba(9,17,34,0.55)] px-3 py-2",
].join(" ");

const VALUE = "font-mono text-[20px] font-light leading-none tracking-[-0.01em] tabular-nums text-(--text)";

const DOT_LIVE = "bg-[#8ef0d9] shadow-[0_0_10px_#5eead4]";
const DOT_IDLE = "bg-[rgba(148,163,184,0.55)]";

interface LiveVitalsStripProps {
  readonly state: LiveHealthState;
  readonly copy: Copy["live"];
  /** Locale for the `HH:MM UTC` stamp (defaults to `en`). */
  readonly locale?: string;
}

function labelFor(id: LiveStripCardId, copy: Copy["live"]): string {
  switch (id) {
    case "heart_rate_bpm":
      return copy.metricHeartRate;
    case "spo2_pct":
      return copy.metricSpo2;
    case "respiratory_rate_bpm":
      return copy.metricRespiratoryRate;
    case "core_temperature_c":
      return copy.metricCoreTemperature;
    case "blood_pressure":
      return copy.metricBloodPressure;
    case "activity_counts":
      return copy.metricActivity;
  }
}

function LiveVitalCard({ card, copy }: { readonly card: LiveStripCard; readonly copy: Copy["live"] }) {
  return (
    <article data-testid="live-vital-card" data-vital={card.id} data-quality={card.quality} className={CARD}>
      <p className="m-0! truncate text-[9px] uppercase tracking-[0.16em] text-(--muted)">{labelFor(card.id, copy)}</p>
      <p className="mt-1.5 mb-0! flex items-baseline gap-1">
        {/* Fresh simulated telemetry, announced politely — same synthetic crew as the tiles below. */}
        <span aria-live="polite" className={VALUE}>
          {card.value}
        </span>
        <span className="text-[10px] font-light text-(--muted)">{card.unit}</span>
      </p>
    </article>
  );
}

/**
 * `/performance` — LIVE vitals strip above the 12 tiles.
 *
 * Three honest states: live (pulsing dot, "LIVE — SIMULATED TELEMETRY"), historical (the backend
 * answered with seed observations only) and offline (no payload at all — the page keeps its
 * fixture fallback). Nothing here is a clinical measurement.
 */
export function LiveVitalsStrip({ state, copy, locale = "en" }: LiveVitalsStripProps) {
  if (!state.settled) return null;

  const mode = liveStripMode(state.data);
  const cards = buildLiveStripCards(state.data);
  const label =
    mode === "live" ? copy.visibleLive : mode === "historical" ? copy.historicalLabel : copy.offlineLabel;
  const pulsing = mode === "live" && !state.stale;
  const stamp = state.updatedAt ? format(copy.lastUpdated, { time: formatLiveUpdatedAt(state.updatedAt, locale) }) : null;

  return (
    <section data-testid="live-vitals-strip" data-state={mode} aria-label={copy.stripAria} className={SECTION}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="m-0! flex items-center gap-2 text-[9.5px] uppercase tracking-[0.2em] text-[rgba(142,240,217,0.85)]">
          <span
            aria-hidden="true"
            className={`inline-block size-[6px] flex-none rounded-full ${pulsing ? `${DOT_LIVE} motion-safe:animate-pulse` : DOT_IDLE}`}
          />
          <span data-testid="live-vitals-label">{label}</span>
        </p>
        {stamp ? (
          <p className="m-0! text-[9px] uppercase tracking-[0.16em] text-(--muted) tabular-nums">{stamp}</p>
        ) : null}
      </div>

      {cards.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2 min-[640px]:grid-cols-3 min-[1100px]:grid-cols-6">
          {cards.map((card) => (
            <LiveVitalCard key={card.id} card={card} copy={copy} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
