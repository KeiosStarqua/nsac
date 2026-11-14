// Watch Mode — minimal glanceable HUD for ≤480px screens and the desktop watch preview.
// Fixture-driven like the staged HUD: every value comes from `vitals.ts` and stays labelled SIMULATED.
// Three swipeable screens (Vitals · Wellness · Sky) behind scroll-snap paging — see watchScreens.ts.
import "../watch-hud.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { MIC_ARIA } from "../voiceCopy";
import { DETAILS, VITAL_VALUES } from "../vitals";
import { WATCH_SCREENS, clampPage, pageIndexFromScroll } from "../watchScreens";
import { useCopy } from "../../../shared/i18n";
import type { VitalKind, VoicePhase } from "../types";

export interface WatchHudProps {
  readonly phase: VoicePhase;
  /** Voice-phase caption, already mapped from `phase` by the owner screen. */
  readonly hint: string;
  readonly micDisabled: boolean;
  /** First name of the claimed crew member, or null when none is picked. */
  readonly astronautName: string | null;
  readonly onToggleMic: () => void;
  readonly onSelectCrew: () => void;
  readonly onVital: (kind: VitalKind) => void;
  readonly onHealth: () => void;
}

export function WatchHud({
  phase,
  hint,
  micDisabled,
  astronautName,
  onToggleMic,
  onSelectCrew,
  onVital,
  onHealth,
}: WatchHudProps) {
  const copy = useCopy();
  const w = copy.watch;
  const reduceMotion = useReducedMotion();
  // Status word derived from the fixture before its parenthetical ("Stable (demo)" → "Stable").
  const healthStatus = DETAILS.health.value.split("(")[0]?.trim() ?? DETAILS.health.value;
  // Fixture message, first line only — clamped with ellipsis in CSS, never rewritten.
  const healthMessage = DETAILS.health.message.split("\n")[0] ?? DETAILS.health.message;
  const mission = DETAILS.mission.value; // Fixture: "ISS · Day 170" — English fixture, both locales.

  const [active, setActive] = useState(0);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);

  // Sync the active dot/chevron state from the scroll position (rAF-throttled, passive listener).
  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setActive(pageIndexFromScroll(el.scrollLeft, el.clientWidth || 1));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const el = pagesRef.current;
      const next = clampPage(index);
      setActive(next);
      if (!el) return;
      const left = next * (el.clientWidth || 1);
      el.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [reduceMotion],
  );

  // Arrow keys page the watch when focus is anywhere inside it; pages keep their own tab order.
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(active - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(active + 1);
    }
  };

  const tiles: ReadonlyArray<{ kind: VitalKind; label: string; aria: string; value: React.ReactNode }> = [
    {
      kind: "heartRate",
      label: w.vitalHeart,
      aria: "Heart rate, demo value 62 beats per minute",
      value: (
        <>
          {VITAL_VALUES.heartRate} <small>bpm</small>
        </>
      ),
    },
    {
      kind: "spo2",
      label: w.vitalSpo2,
      aria: "Oxygen saturation, demo value 98 percent",
      value: (
        <>
          {VITAL_VALUES.spo2} <small>%</small>
        </>
      ),
    },
    {
      kind: "respiration",
      label: w.vitalResp,
      aria: "Respiration, demo value 16 breaths per minute",
      value: (
        <>
          {VITAL_VALUES.respiration} <small>br/min</small>
        </>
      ),
    },
    {
      kind: "sleep",
      label: w.vitalSleep,
      aria: "Sleep, demo value seven hours and forty-two minutes",
      value: (
        <>
          {VITAL_VALUES.sleepHours} <small>h</small> {VITAL_VALUES.sleepMinutes} <small>m</small>
        </>
      ),
    },
  ];

  const dotLabels = [w.screenVitals, w.screenWellness, w.screenSky];

  return (
    <section className="watch-hud" aria-label="SKY astronaut wellness, watch view" onKeyDown={onKeyDown}>
      {/* Top strip: crew chip · SIMULATED tag · mission chip */}
      <header className="watch-top">
        <button
          type="button"
          className="watch-crew"
          onClick={onSelectCrew}
          aria-label={astronautName ? `${copy.astronaut.change}: ${astronautName}` : w.selectCrew}
        >
          <span className="watch-crew-dot" aria-hidden="true" />
          <span className="watch-crew-name">{astronautName ?? w.selectCrew}</span>
        </button>
        <span className="watch-tag">{w.simulated}</span>
        <span className="watch-mission">{mission}</span>
      </header>

      {/* Paged area — three screens, scroll-snap; dots and chevrons page them */}
      <div className="watch-pager">
        <div className="watch-pages" ref={pagesRef}>
          {/* Screen 1 — Vitals: the 2×2 grid, big tiles filling the page */}
          <section className="watch-page watch-page-vitals" role="region" aria-label={w.screenVitals}>
            <div className="watch-vitals" role="group" aria-label="Sample physiological readings">
              {tiles.map((tile) => (
                <button
                  key={tile.kind}
                  type="button"
                  className="watch-vital"
                  aria-label={tile.aria}
                  onClick={() => onVital(tile.kind)}
                >
                  <span className="watch-vital-label">{tile.label}</span>
                  <span className="watch-vital-value">{tile.value}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Screen 2 — Wellness: fixture status, one line of fixture copy, one big button */}
          <section className="watch-page watch-page-wellness" role="region" aria-label={w.screenWellness}>
            <p className="watch-wellness-caption">{DETAILS.health.title}</p>
            <p className="watch-wellness-status">{healthStatus}</p>
            <p className="watch-wellness-line">{healthMessage}</p>
            <button type="button" className="watch-view-details" onClick={onHealth}>
              {w.viewDetails}
            </button>
          </section>

          {/* Screen 3 — Sky: big mic and the phase hint, nothing else */}
          <section className="watch-page watch-page-sky" role="region" aria-label={w.screenSky}>
            <button
              id="micButton"
              className="mic-button watch-mic"
              type="button"
              aria-label={MIC_ARIA[phase]}
              disabled={micDisabled}
              onClick={onToggleMic}
            >
              <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="8" width="12" height="24" rx="6" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M13 24c0 15 22 15 22 0M24 36v6m-7 0h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
            </button>
            <p className="voice-hint watch-hint" aria-live="polite">{hint}</p>
          </section>
        </div>

        {/* Chevrons — page backwards/forwards; clamped at both ends */}
        <button
          type="button"
          className="watch-chevron watch-chevron-prev"
          aria-label={w.screenPrevious}
          onClick={() => goTo(active - 1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button
          type="button"
          className="watch-chevron watch-chevron-next"
          aria-label={w.screenNext}
          onClick={() => goTo(active + 1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* Dots — one per screen, active screen marked with aria-current */}
      <div className="watch-dots">
        {WATCH_SCREENS.map((screen, i) => (
          <button
            key={screen.id}
            type="button"
            className="watch-dot"
            aria-label={dotLabels[i]}
            aria-current={active === i ? "true" : undefined}
            onClick={() => goTo(i)}
          >
            <span className="watch-dot-mark" aria-hidden="true" />
          </button>
        ))}
      </div>

      {/* Footer — tiny disclaimer, always visible */}
      <footer className="watch-footer">
        AI-generated, not a substitute for a physician · {w.demonstrationOnly}
      </footer>
    </section>
  );
}
