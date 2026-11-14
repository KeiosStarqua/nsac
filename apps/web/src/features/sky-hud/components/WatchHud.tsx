// Watch Mode — minimal glanceable HUD rendered full-screen by the `/watch` route; the hud-gen
// below-480px fallback shares it. Fixture-driven like the staged HUD: every value comes from
// `vitals.ts` and stays labelled SIMULATED.
// Three swipeable screens (Vitals · Wellness · Sky) behind scroll-snap paging — see watchScreens.ts.
//
// Styling: Tailwind utilities (see `hud-classes.ts` for the shared console strings). The classes
// scoped to the AI-generated watch mockup are `[.watch-screen_&]` arbitrary variants — they keep the
// old `.watch-screen …` specificity (0,2,0), so they still beat the ≤480px and short-viewport rules
// exactly like `watch-device.css` did.
import "../hud-keyframes.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { MIC_ARIA } from "../voiceCopy";
import { DETAILS, VITAL_VALUES } from "../vitals";
import { WATCH_SCREENS, clampPage, pageIndexFromScroll } from "../watchScreens";
import { micButtonClass } from "../hud-classes";
import { useCopy } from "../../../shared/i18n";
import type { VitalKind, VoicePhase } from "../types";

// ---- Watch face classes (were watch-hud.css + the `.watch-screen` half of watch-device.css) --------

const WATCH_HUD = [
  // Full-screen watch layout (≤480px route fallback) …
  "relative z-[5] flex h-dvh min-h-dvh flex-col gap-[8px] overflow-x-hidden overflow-y-auto",
  "pt-[calc(env(safe-area-inset-top,0px)_+_8px)] pr-[calc(env(safe-area-inset-right,0px)_+_10px)] pb-[calc(env(safe-area-inset-bottom,0px)_+_6px)] pl-[calc(env(safe-area-inset-left,0px)_+_10px)]",
  "text-[#edf8ff]",
  // … compact pass for short viewports (e.g. 160×240 watch) …
  "[@media(max-height:560px)]:gap-[4px] [@media(max-height:560px)]:pt-[calc(env(safe-area-inset-top,0px)_+_4px)] [@media(max-height:560px)]:pb-[calc(env(safe-area-inset-bottom,0px)_+_4px)]",
  // … and the same HUD inside the smartwatch mockup's glass face (cqw/cqh, no scrolling).
  "[.watch-screen_&]:z-[1] [.watch-screen_&]:h-full [.watch-screen_&]:min-h-0 [.watch-screen_&]:justify-start [.watch-screen_&]:gap-[1.3cqh] [.watch-screen_&]:overflow-hidden [.watch-screen_&]:[padding:5cqh_4.6cqw]",
].join(" ");

const WATCH_TOP = [
  "flex flex-none items-center justify-between gap-[6px] min-h-[36px]",
  // ≥481px full-screen layout: right gutter so the floating chip never covers the mission chip.
  "min-[481px]:pr-[240px]",
  "[@media(max-height:560px)]:min-h-[26px]",
  "[.watch-screen_&]:min-h-[4.8cqh] [.watch-screen_&]:justify-center [.watch-screen_&]:gap-[2cqw] [.watch-screen_&]:pr-0",
].join(" ");

const WATCH_CREW = [
  "inline-flex min-h-[34px] max-w-[56%] cursor-pointer items-center gap-[6px] rounded-full! border",
  "border-[rgba(120,234,255,.35)] bg-[rgba(8,34,66,.6)] px-[12px] py-[3px]",
  "text-[12px]! tracking-[.02em] whitespace-nowrap text-[#d9f4ff]",
  "[@media(max-height:560px)]:min-h-[28px] [@media(max-height:560px)]:px-[9px] [@media(max-height:560px)]:py-[2px] [@media(max-height:560px)]:text-[10.5px]!",
  "[.watch-screen_&]:min-h-[4.3cqh] [.watch-screen_&]:max-w-[46%] [.watch-screen_&]:gap-[1.2cqw] [.watch-screen_&]:px-[2cqw] [.watch-screen_&]:py-[.5cqh] [.watch-screen_&]:text-[1.95cqw]! [.watch-screen_&]:tracking-[.02em]",
].join(" ");

const WATCH_CREW_DOT = "size-[7px] flex-none rounded-full bg-[#60efc0] shadow-[0_0_6px_rgba(96,239,192,.8)] [.watch-screen_&]:size-[1.5cqw]";

const WATCH_CREW_NAME = "overflow-hidden text-ellipsis";

const WATCH_TAG = [
  "flex-none whitespace-nowrap rounded-[4px] border border-[rgba(120,234,255,.32)] px-[6px] py-[3px]",
  "text-[9px] tracking-[.2em] text-[#88e1f6]",
  "[@media(max-height:560px)]:px-[5px] [@media(max-height:560px)]:py-[2px] [@media(max-height:560px)]:text-[8px]",
  "[.watch-screen_&]:rounded-[.7cqw] [.watch-screen_&]:px-[1.1cqw] [.watch-screen_&]:py-[.55cqh] [.watch-screen_&]:text-[1.45cqw]",
].join(" ");

const WATCH_MISSION = [
  "flex-none whitespace-nowrap rounded-full border border-[rgba(168,187,206,.28)] px-[8px] py-[3px]",
  "text-[10px] text-[#a8bbce]",
  "[@media(max-height:560px)]:px-[6px] [@media(max-height:560px)]:py-[2px] [@media(max-height:560px)]:text-[9px]",
  "[.watch-screen_&]:px-[1.4cqw] [.watch-screen_&]:py-[.55cqh] [.watch-screen_&]:text-[1.55cqw]",
].join(" ");

const WATCH_PAGER = "relative flex min-h-0 flex-auto";

const WATCH_PAGES = [
  "flex min-w-0 flex-auto snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-[18px]",
  "[-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
].join(" ");

const WATCH_PAGE = [
  "flex min-w-0 flex-[0_0_100%] snap-center flex-col overflow-x-hidden overflow-y-auto px-[46px]",
  "[@media(max-height:560px)]:px-[44px]",
  "[.watch-screen_&]:px-[7.6cqw]",
].join(" ");

const WATCH_VITALS = [
  "grid h-full min-h-0 flex-auto grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-[10px]",
  "[@media(max-height:560px)]:gap-[5px]",
  "[@media(max-height:560px)_and_(orientation:landscape)]:grid-cols-[repeat(4,minmax(0,1fr))] [@media(max-height:560px)_and_(orientation:landscape)]:grid-rows-[minmax(0,1fr)]",
  "[.watch-screen_&]:gap-[1.6cqh]",
].join(" ");

const WATCH_VITAL = [
  "flex min-h-[88px] cursor-pointer flex-col items-start justify-center gap-[6px] rounded-[18px]! border",
  "bg-transparent",
  "border-[rgba(120,234,255,.22)] bg-[linear-gradient(160deg,rgba(14,42,72,.72),rgba(6,19,33,.88))] p-[14px_16px]",
  "text-left text-[#edf8ff] shadow-[inset_0_0_18px_rgba(88,225,255,.06)] active:border-[rgba(120,234,255,.55)]",
  "focus-visible:outline-2! focus-visible:outline-offset-[5px]! focus-visible:outline-[#f5fcff]!",
  "[@media(max-height:560px)]:min-h-[56px] [@media(max-height:560px)]:gap-[2px] [@media(max-height:560px)]:rounded-[12px]! [@media(max-height:560px)]:p-[6px_10px]",
  "[@media(max-height:560px)_and_(orientation:landscape)]:min-h-[42px] [@media(max-height:560px)_and_(orientation:landscape)]:items-center [@media(max-height:560px)_and_(orientation:landscape)]:text-center",
  "[.watch-screen_&]:min-h-[21cqh] [.watch-screen_&]:gap-[1cqh] [.watch-screen_&]:rounded-[2.6cqw]! [.watch-screen_&]:p-[2cqh_2.6cqw]",
].join(" ");

const WATCH_VITAL_LABEL = [
  "text-[10px] tracking-[.2em] text-[#88e1f6]",
  "[@media(max-height:560px)]:text-[7.5px] [@media(max-height:560px)]:tracking-[.09em]",
  "[.watch-screen_&]:text-[1.7cqw] [.watch-screen_&]:tracking-[.18em]",
].join(" ");

const WATCH_VITAL_VALUE = [
  "flex flex-wrap items-baseline gap-x-[6px] gap-y-0 whitespace-nowrap text-[47px] font-light leading-[1.02]",
  "[&_small]:text-[15px] [&_small]:tracking-[.05em] [&_small]:text-[#a8bbce]",
  "[@media(max-height:560px)]:text-[22px] [@media(max-height:560px)]:[&_small]:text-[9px]",
  "[.watch-screen_&]:text-[8.8cqw] [.watch-screen_&]:[column-gap:1.4cqw] [.watch-screen_&]:[&_small]:text-[2.6cqw]",
].join(" ");

const WATCH_PAGE_VITALS = "py-[6px]";

const WATCH_PAGE_WELLNESS = "items-center justify-center gap-[4px] py-[12px] text-center [.watch-screen_&]:gap-[.8cqh]";

const WATCH_WELLNESS_CAPTION = [
  "text-[10px] uppercase tracking-[.24em] text-[#88e1f6]",
  "[@media(max-height:560px)]:text-[8px] [@media(max-height:560px)]:tracking-[.14em]",
  "[.watch-screen_&]:text-[1.9cqw] [.watch-screen_&]:tracking-[.22em]",
].join(" ");

const WATCH_WELLNESS_STATUS = [
  "max-w-full overflow-hidden text-ellipsis whitespace-nowrap! text-[clamp(40px,13vw,60px)] font-extralight leading-none tracking-[.01em] text-[#60efc0]",
  "[@media(max-height:560px)]:text-[clamp(26px,11vw,40px)]",
  "[.watch-screen_&]:text-[9cqw]",
].join(" ");

const WATCH_WELLNESS_LINE = [
  "max-w-full overflow-hidden text-ellipsis whitespace-nowrap! text-[11px] leading-[1.4] text-[#a8bbce]",
  "[@media(max-height:560px)]:text-[9px]",
  "[.watch-screen_&]:text-[1.8cqw]",
].join(" ");

const WATCH_VIEW_DETAILS = [
  "mt-auto w-full min-h-[56px] cursor-pointer rounded-[16px]! border",
  "bg-transparent",
  "border-[rgba(120,234,255,.38)] bg-[linear-gradient(160deg,rgba(18,56,88,.85),rgba(8,26,44,.92))]",
  "text-[14px]! tracking-[.06em] text-[#d9f4ff] shadow-[inset_0_0_18px_rgba(88,225,255,.08)]",
  "hover:border-[rgba(140,231,255,.6)] hover:text-[#eafdff]",
  "focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[#d9f6ff]!",
  "[@media(max-height:560px)]:min-h-[44px] [@media(max-height:560px)]:text-[12px]!",
  "[.watch-screen_&]:min-h-[8.8cqh] [.watch-screen_&]:rounded-[2.6cqw]! [.watch-screen_&]:px-[3cqw] [.watch-screen_&]:py-0 [.watch-screen_&]:text-[2.6cqw]! [.watch-screen_&]:tracking-[.05em]",
].join(" ");

const WATCH_PAGE_SKY = "items-center justify-center gap-[12px] py-[12px]";

const WATCH_HINT = [
  "m-0 max-w-full whitespace-normal text-center text-[14px] font-light text-[#f0f7ff]",
  "[text-shadow:0_0_12px_rgba(80,183,255,.2)]",
  "[@media(max-height:560px)]:text-[10.5px]",
  "[.watch-screen_&]:text-[2.1cqw] [.watch-screen_&]:leading-[1.35]",
].join(" ");

const WATCH_CHEVRON = [
  "absolute top-1/2 z-[2] inline-flex size-[44px] cursor-pointer items-center justify-center rounded-full! border",
  "border-[rgba(120,234,255,.32)] bg-[rgba(9,28,48,.55)] text-[rgba(140,231,255,.65)] opacity-[.55] backdrop-blur-[2px]",
  "[transform:translateY(-50%)] [transition:opacity_.18s,color_.18s,border-color_.18s]",
  "hover:border-[rgba(140,231,255,.6)] hover:text-[#d9f6ff] hover:opacity-100",
  "focus-visible:text-[#eafdff] focus-visible:opacity-100 focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[#d9f6ff]!",
  "[&_svg]:size-[22px]",
  "[.watch-screen_&]:size-[6.8cqw] [.watch-screen_&]:min-h-[44px] [.watch-screen_&]:min-w-[44px] [.watch-screen_&]:[&_svg]:size-[3.4cqw]",
].join(" ");

const WATCH_CHEVRON_PREV = "left-[1px]";
const WATCH_CHEVRON_NEXT = "right-[1px]";

const WATCH_DOTS = [
  "flex flex-none items-center justify-center gap-[4px] px-0 py-[1px]",
  "[@media(max-height:560px)]:py-0",
  "[.watch-screen_&]:py-[.4cqh]",
].join(" ");

const WATCH_DOT = [
  "inline-flex size-[28px] cursor-pointer items-center justify-center rounded-full! border-0 bg-transparent",
  "focus-visible:outline-2! focus-visible:outline-offset-[1px]! focus-visible:outline-[#d9f6ff]!",
  "[.watch-screen_&]:size-[4.2cqh] [.watch-screen_&]:min-h-[28px] [.watch-screen_&]:min-w-[28px]",
].join(" ");

const WATCH_DOT_MARK = "size-[8px] rounded-full transition-[background,box-shadow,transform] duration-200 [.watch-screen_&]:size-[1.7cqw]";
const WATCH_DOT_MARK_IDLE = "bg-[rgba(120,234,255,.32)]";
/** Was `.watch-dot[aria-current="true"] .watch-dot-mark`. */
const WATCH_DOT_MARK_ACTIVE = "bg-[#78eaff] shadow-[0_0_8px_rgba(120,234,255,.7)] [transform:scale(1.35)]";

const WATCH_FOOTER = [
  "flex-none px-[6px] py-[2px] text-center text-[8.5px] leading-[1.45] tracking-[.02em] text-[#8ba9be]",
  "[@media(max-height:560px)]:text-[6.5px] [@media(max-height:560px)]:leading-[1.25]",
  "[.watch-screen_&]:px-[1cqw] [.watch-screen_&]:py-0 [.watch-screen_&]:text-[1.32cqw] [.watch-screen_&]:leading-[1.45]",
].join(" ");

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
    <section className={WATCH_HUD} aria-label="SKY astronaut wellness, watch view" onKeyDown={onKeyDown}>
      {/* Top strip: crew chip · SIMULATED tag · mission chip */}
      <header className={WATCH_TOP}>
        <button
          type="button"
          className={WATCH_CREW}
          onClick={onSelectCrew}
          aria-label={astronautName ? `${copy.astronaut.change}: ${astronautName}` : w.selectCrew}
        >
          <span className={WATCH_CREW_DOT} aria-hidden="true" />
          <span className={WATCH_CREW_NAME}>{astronautName ?? w.selectCrew}</span>
        </button>
        <span className={WATCH_TAG}>{w.simulated}</span>
        <span className={WATCH_MISSION}>{mission}</span>
      </header>

      {/* Paged area — three screens, scroll-snap; dots and chevrons page them */}
      <div className={WATCH_PAGER}>
        <div className={WATCH_PAGES} ref={pagesRef}>
          {/* Screen 1 — Vitals: the 2×2 grid, big tiles filling the page */}
          <section className={`${WATCH_PAGE} ${WATCH_PAGE_VITALS}`} role="region" aria-label={w.screenVitals}>
            <div className={WATCH_VITALS} role="group" aria-label="Sample physiological readings">
              {tiles.map((tile) => (
                <button
                  key={tile.kind}
                  type="button"
                  className={WATCH_VITAL}
                  aria-label={tile.aria}
                  onClick={() => onVital(tile.kind)}
                >
                  <span className={WATCH_VITAL_LABEL}>{tile.label}</span>
                  <span className={WATCH_VITAL_VALUE}>{tile.value}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Screen 2 — Wellness: fixture status, one line of fixture copy, one big button */}
          <section className={`${WATCH_PAGE} ${WATCH_PAGE_WELLNESS}`} role="region" aria-label={w.screenWellness}>
            <p className={WATCH_WELLNESS_CAPTION}>{DETAILS.health.title}</p>
            <p className={WATCH_WELLNESS_STATUS}>{healthStatus}</p>
            <p className={WATCH_WELLNESS_LINE}>{healthMessage}</p>
            <button type="button" className={WATCH_VIEW_DETAILS} onClick={onHealth}>
              {w.viewDetails}
            </button>
          </section>

          {/* Screen 3 — Sky: big mic and the phase hint, nothing else */}
          <section className={`${WATCH_PAGE} ${WATCH_PAGE_SKY}`} role="region" aria-label={w.screenSky}>
            <button
              id="micButton"
              className={micButtonClass(phase, "watch")}
              type="button"
              aria-label={MIC_ARIA[phase]}
              disabled={micDisabled}
              onClick={onToggleMic}
            >
              <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="8" width="12" height="24" rx="6" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M13 24c0 15 22 15 22 0M24 36v6m-7 0h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
            </button>
            <p className={WATCH_HINT} aria-live="polite">{hint}</p>
          </section>
        </div>

        {/* Chevrons — page backwards/forwards; clamped at both ends */}
        <button
          type="button"
          className={`${WATCH_CHEVRON} ${WATCH_CHEVRON_PREV}`}
          aria-label={w.screenPrevious}
          onClick={() => goTo(active - 1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button
          type="button"
          className={`${WATCH_CHEVRON} ${WATCH_CHEVRON_NEXT}`}
          aria-label={w.screenNext}
          onClick={() => goTo(active + 1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* Dots — one per screen, active screen marked with aria-current */}
      <div className={WATCH_DOTS}>
        {WATCH_SCREENS.map((screen, i) => (
          <button
            key={screen.id}
            type="button"
            className={WATCH_DOT}
            aria-label={dotLabels[i]}
            aria-current={active === i ? "true" : undefined}
            onClick={() => goTo(i)}
          >
            <span className={`${WATCH_DOT_MARK} ${active === i ? WATCH_DOT_MARK_ACTIVE : WATCH_DOT_MARK_IDLE}`} aria-hidden="true" />
          </button>
        ))}
      </div>

      {/* Footer — tiny disclaimer, always visible */}
      <footer className={WATCH_FOOTER}>
        AI-generated, not a substitute for a physician · {w.demonstrationOnly}
      </footer>
    </section>
  );
}
