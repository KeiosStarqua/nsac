// Watch Mode — glanceable HUD rendered full-screen by the `/watch` route; the hud-gen below-480px
// fallback shares it. Fixture-driven like the staged HUD: every value comes from `vitals.ts` and
// stays labelled SIMULATED. Three swipeable screens (Vitals · Wellness · Sky) behind scroll-snap
// paging — see watchScreens.ts.
//
// Design language: watchOS 26 dark appearance, measured from Apple's watchOS 26 Design Resources
// (facts only — no Apple artwork or SF fonts, see `docs/design/watchos-26/`). Metrics and alphas
// cited inline as `watchos-26 tokens.json — <key>`; the reference is the layout spec, not artwork.
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
import { useCopy, useLocale } from "../../../shared/i18n";
import type { VitalKind, VoicePhase } from "../types";

// ---- Watch face classes (were watch-hud.css + the `.watch-screen` half of watch-device.css) --------
// watchOS 26 tokens.json — Grays/White dark #F2F4FC is the one label colour; Label/* alphas carry the
// hierarchy (primary 1 · secondary .75 · tertiary .6 · quaternary .32).

const WATCH_HUD = [
  // Full-screen watch layout (≤480px route fallback) …
  "relative z-[5] flex h-dvh min-h-dvh flex-col gap-[8px] overflow-x-hidden overflow-y-auto",
  "pt-[calc(env(safe-area-inset-top,0px)_+_8px)] pr-[calc(env(safe-area-inset-right,0px)_+_10px)] pb-[calc(env(safe-area-inset-bottom,0px)_+_6px)] pl-[calc(env(safe-area-inset-left,0px)_+_10px)]",
  "text-[#F2F4FC]",
  // … compact pass for short viewports (e.g. 160×240 watch) …
  "[@media(max-height:560px)]:gap-[4px] [@media(max-height:560px)]:pt-[calc(env(safe-area-inset-top,0px)_+_4px)] [@media(max-height:560px)]:pb-[calc(env(safe-area-inset-bottom,0px)_+_4px)]",
  // … and the same HUD inside the smartwatch mockup's glass face (cqw/cqh, no scrolling).
  // watchOS 26 tokens.json — Margin - TB - Safe Area 46mm 18pt of 248pt ≈ 7cqh; 6.2cqh keeps the
  // status row clear of the face's rounded top corners (the glass radius clips ~2.5cqw at that
  // height) while leaving the platters room.
  "[.watch-screen_&]:z-[1] [.watch-screen_&]:h-full [.watch-screen_&]:min-h-0 [.watch-screen_&]:justify-start [.watch-screen_&]:gap-[1.6cqh] [.watch-screen_&]:overflow-hidden [.watch-screen_&]:[padding:6.2cqh_4.6cqw_4.4cqh]",
].join(" ");

// Status block — watchOS 26 Nav Bar pattern: status row (crew complication + clock), then one
// caption line. watchOS 26 tokens.json — Nav Bar/Height - Status Bar 46mm 38pt.
const WATCH_STATUS = [
  "flex flex-none flex-col gap-[6px]",
  // ≥481px full-screen layout: right gutter so the floating Console|Watch chip never covers the clock.
  "min-[481px]:pr-[240px]",
  "[@media(max-height:560px)]:gap-[3px]",
  // In-face: the glass has large rounded corners, so the status block sits inside a small LR inset
  // (the clock would otherwise be clipped by the top-right radius).
  "[.watch-screen_&]:gap-[1cqh] [.watch-screen_&]:pl-[2.2cqw] [.watch-screen_&]:pr-[2.2cqw]",
].join(" ");

const WATCH_STATUS_ROW = "flex flex-none items-center justify-between gap-[2cqw]";

const WATCH_CREW = [
  "inline-flex min-h-[34px] max-w-[64%] cursor-pointer items-center gap-[7px] rounded-full! border-0 bg-transparent p-0",
  "text-[12px]! font-medium! tracking-[.01em] text-[rgba(242,244,252,.75)]",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#F2F4FC]!",
  "[@media(max-height:560px)]:min-h-[28px] [@media(max-height:560px)]:text-[10.5px]!",
  "[.watch-screen_&]:min-h-[4.4cqh] [.watch-screen_&]:gap-[1.7cqw] [.watch-screen_&]:text-[2.05cqw]!",
].join(" ");

// Crew monogram complication: watchOS 26 tokens.json — Fills/quaternary dark #F2F4FC @ .10 (raised a
// touch to .12 so the circle reads on true black); Label/primary for the letter.
const WATCH_CREW_MONOGRAM = [
  "grid size-[30px] flex-none place-items-center rounded-full bg-[rgba(242,244,252,.12)] text-[13px]! font-semibold! uppercase leading-none text-[#F2F4FC]",
  "[@media(max-height:560px)]:size-[25px] [@media(max-height:560px)]:text-[11px]!",
  "[.watch-screen_&]:size-[5.6cqw] [.watch-screen_&]:text-[2.4cqw]!",
].join(" ");

const WATCH_CREW_NAME = "overflow-hidden text-ellipsis whitespace-nowrap";

// Live clock, right side of the status row — hours:minutes in the status bar position.
// watchOS 26 tokens.json — Nav Bar/Height - Status Bar 46mm 38pt; Label/primary.
const WATCH_CLOCK = [
  "min-w-[5ch] flex-none text-right text-[13px]! font-semibold! leading-none tabular-nums tracking-[.01em] text-[#F2F4FC]",
  "[@media(max-height:560px)]:text-[11px]!",
  "[.watch-screen_&]:text-[2.5cqw]!",
].join(" ");

// One caption line: mission day left, SIMULATED right. watchOS 26 tokens.json — Label/tertiary dark
// @ .6 for both (SIMULATED is the fixture label and MUST stay visibly readable, DESIGN.md §0).
const WATCH_STATUS_CAPTION = [
  "flex flex-none items-center justify-between gap-[2cqw] text-[9px] leading-none tracking-[.16em] uppercase",
  "[@media(max-height:560px)]:text-[7.5px]",
  "[.watch-screen_&]:text-[1.7cqw] [.watch-screen_&]:tracking-[.18em]",
].join(" ");

const WATCH_MISSION = "text-[rgba(242,244,252,.6)]";
const WATCH_TAG = "text-[rgba(242,244,252,.6)]";

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
  "[.watch-screen_&]:gap-[1.8cqh]",
].join(" ");

// Vitals platter — Apple Fitness-style tile, no border, no glow.
// watchOS 26 tokens.json — Fills/quaternary dark #F2F4FC @ .10 (tile fill) and List/Radius 46mm 13.5pt
// (≈3.6cqw on our 53%-tall face); active state lifts to Fills/secondary @ .20 territory (.16).
const WATCH_VITAL = [
  "flex min-h-[88px] cursor-pointer flex-col items-start justify-center gap-[6px] rounded-[18px]! border-0",
  "bg-[rgba(242,244,252,.1)] p-[14px_16px] text-left [transition:background_.16s]",
  "hover:bg-[rgba(242,244,252,.13)] active:bg-[rgba(242,244,252,.16)] motion-reduce:transition-none",
  "focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[#F2F4FC]!",
  "[@media(max-height:560px)]:min-h-[56px] [@media(max-height:560px)]:gap-[2px] [@media(max-height:560px)]:rounded-[12px]! [@media(max-height:560px)]:p-[6px_10px]",
  "[@media(max-height:560px)_and_(orientation:landscape)]:min-h-[42px] [@media(max-height:560px)_and_(orientation:landscape)]:items-center [@media(max-height:560px)_and_(orientation:landscape)]:text-center [@media(max-height:560px)_and_(orientation:landscape)]:[&_svg]:hidden",
  "[.watch-screen_&]:min-h-[21cqh] [.watch-screen_&]:gap-[.9cqh] [.watch-screen_&]:rounded-[3.6cqw]! [.watch-screen_&]:p-[2.3cqh_2.4cqw]",
].join(" ");

// Tile top row: accent glyph + metric name. Body copy is sentence case — Apple does not shout in
// body text; watchOS 26 text-styles.json — Large/Body 16pt ≈ 1.75cqw of the 208pt-wide face.
const WATCH_VITAL_LABEL = [
  "flex items-center gap-[6px] text-[10px] font-semibold leading-none tracking-[.01em] text-[rgba(242,244,252,.75)]",
  "[@media(max-height:560px)]:text-[7.5px] [@media(max-height:560px)]:gap-[3px]",
  "[.watch-screen_&]:gap-[1.1cqw] [.watch-screen_&]:text-[1.75cqw]",
].join(" ");

const WATCH_VITAL_GLYPH = "size-[13px] flex-none [&_svg]:block [&_svg]:h-full [&_svg]:w-full [.watch-screen_&]:size-[3.1cqw]";

// watchOS 26 text-styles.json — the LCD-style value reads as Large Title/Title 1 in the ramp
// (36pt of a 208×248 face ≈ 17cqw of width, we sit at 8.6cqw for the 2×2 grid); Label/primary with
// a tertiary unit riding the baseline.
const WATCH_VITAL_VALUE = [
  "flex flex-wrap items-baseline gap-x-[.28em] whitespace-nowrap text-[40px] font-semibold leading-none tabular-nums text-[#F2F4FC]",
  "[&_small]:text-[.32em] [&_small]:font-medium [&_small]:tracking-[.02em] [&_small]:text-[rgba(242,244,252,.6)]",
  "[@media(max-height:560px)]:text-[20px]",
  "[.watch-screen_&]:text-[8.6cqw]",
].join(" ");

const WATCH_PAGE_VITALS = "py-[6px]";

const WATCH_PAGE_WELLNESS = "items-center py-[12px] text-center [.watch-screen_&]:py-[.6cqh]";

// Copy group fills the space above the pill and centres itself in it (Apple puts the status copy in
// the optical middle and the action at the bottom), instead of pooling at the top.
const WATCH_WELLNESS_GROUP =
  "flex w-full min-h-0 flex-auto flex-col items-center justify-center gap-[4px] [.watch-screen_&]:gap-[.9cqh]";

// watchOS 26 tokens.json — Label/tertiary dark @ .6; uppercase micro-caption, tracking .22em.
const WATCH_WELLNESS_CAPTION = [
  "text-[10px] uppercase tracking-[.24em] text-[rgba(242,244,252,.5)]",
  "[@media(max-height:560px)]:text-[8px] [@media(max-height:560px)]:tracking-[.14em]",
  "[.watch-screen_&]:text-[1.9cqw] [.watch-screen_&]:tracking-[.22em]",
].join(" ");

// Status word: watchOS 26 tokens.json — Label/primary dark #F2F4FC; Large Title is Light in watchOS
// (xSmall/Title 3 is the one Light style), so: light weight, tight leading, no uppercase.
const WATCH_WELLNESS_STATUS = [
  "max-w-full overflow-hidden text-ellipsis whitespace-nowrap! text-[clamp(38px,12vw,56px)] font-light leading-[.98] tracking-[.005em] text-[#F2F4FC]",
  "[@media(max-height:560px)]:text-[clamp(24px,10vw,36px)]",
  "[.watch-screen_&]:text-[9.4cqw]",
].join(" ");

// watchOS 26 tokens.json — Label/tertiary dark @ .6 (secondary body of a status view).
const WATCH_WELLNESS_LINE = [
  "max-w-full overflow-hidden text-ellipsis whitespace-nowrap! text-[11px] leading-[1.4] text-[rgba(242,244,252,.6)]",
  "[@media(max-height:560px)]:text-[9px]",
  "[.watch-screen_&]:text-[1.8cqw]",
].join(" ");

// Primary pill — watchOS 26 tokens.json — Accents/Cyan dark #3CD3FE (filled), Button/Height - Pill
// 46mm 52.5pt of 248pt ≈ 21cqh (we use 8.6cqh to leave the caption + status word room); the label is
// near-black on cyan so it passes contrast. Radius is half the height (a pill), never a rounded box.
const WATCH_VIEW_DETAILS = [
  "w-full min-h-[44px] flex-none cursor-pointer rounded-full! border-0 px-[16px] py-0",
  "bg-[#3CD3FE] text-[13px]! font-semibold! tracking-[.01em]! text-[#00141D]",
  "hover:bg-[#6DD9FF] active:bg-[#00C0E8] [transition:background_.16s] motion-reduce:transition-none",
  "focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[#F2F4FC]!",
  "[@media(max-height:560px)]:text-[11px]!",
  "[.watch-screen_&]:min-h-[8.6cqh] [.watch-screen_&]:px-[3cqw] [.watch-screen_&]:text-[2.6cqw]!",
].join(" ");

const WATCH_PAGE_SKY = "items-center justify-center gap-[10px] py-[12px] [.watch-screen_&]:gap-[2.2cqh]";

// watchOS 26 tokens.json — Label/tertiary dark @ .6, same micro-caption ramp as the wellness screen.
const WATCH_SKY_CAPTION = [
  "text-[10px] uppercase tracking-[.24em] text-[rgba(242,244,252,.5)]",
  "[@media(max-height:560px)]:text-[8px] [@media(max-height:560px)]:tracking-[.14em]",
  "[.watch-screen_&]:text-[1.9cqw] [.watch-screen_&]:tracking-[.22em]",
].join(" ");

// Filled dictation circle: watchOS 26 tokens.json — Grays/White dark #F2F4FC plate with the glyph in
// near-black (Label/primary inverted); Button/Height - Circular 46mm 47pt of 248pt ≈ 19cqh, we draw
// 17.5cqw of the face width. Listening swaps in an Accents/Mint dark #00DAC3 ring (glow is static, so
// reduced motion only has to collapse the transitions).
const WATCH_MIC = [
  "grid size-[104px] min-h-[104px] min-w-[104px] cursor-pointer place-items-center rounded-full! border-0 p-0",
  "bg-[#F2F4FC] text-[#0A0A0A] [transition:transform_.2s,background_.2s] motion-reduce:transition-none",
  "hover:[transform:scale(1.04)] active:[transform:scale(.97)] disabled:cursor-wait",
  "[&_svg]:block [&_svg]:h-[46%] [&_svg]:w-[46%]",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#F2F4FC]!",
  "[@media(max-height:560px)]:size-[72px] [@media(max-height:560px)]:min-h-[72px] [@media(max-height:560px)]:min-w-[72px]",
  "[.watch-screen_&]:size-[17.5cqw] [.watch-screen_&]:min-h-0 [.watch-screen_&]:min-w-0",
].join(" ");

const WATCH_HINT = [
  "m-0 max-w-full whitespace-normal text-center text-[13px] font-light leading-[1.35] text-[rgba(242,244,252,.75)]",
  "[@media(max-height:560px)]:text-[10px]",
  "[.watch-screen_&]:text-[2.05cqw]",
].join(" ");

// Chevrons stay (they page the screens) but recede to a hint: watchOS 26 tokens.json — Label/tertiary
// @ .6, dimmed to .4 at rest (still ≥3:1 non-text) until hover/focus; white on interaction.
const WATCH_CHEVRON = [
  "absolute top-1/2 z-[2] inline-flex size-[44px] cursor-pointer items-center justify-center rounded-full! border-0",
  "bg-transparent text-[rgba(242,244,252,.7)] opacity-40",
  "[transform:translateY(-50%)] [transition:opacity_.18s,color_.18s] motion-reduce:transition-none",
  "hover:text-[#F2F4FC] hover:opacity-100",
  "focus-visible:text-[#F2F4FC] focus-visible:opacity-100 focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[#F2F4FC]!",
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
  "focus-visible:outline-2! focus-visible:outline-offset-[1px]! focus-visible:outline-[#F2F4FC]!",
  "[.watch-screen_&]:size-[4.2cqh] [.watch-screen_&]:min-h-[28px] [.watch-screen_&]:min-w-[28px]",
].join(" ");

// watchOS 26 tokens.json — active page mark is Label/primary at full strength; idle sits at the
// Fill/quaternary .10–.22 band. No accent glow: the current page is read from brightness, not colour.
const WATCH_DOT_MARK =
  "size-[8px] rounded-full transition-[background,transform] duration-200 motion-reduce:transition-none [.watch-screen_&]:size-[1.7cqw]";
const WATCH_DOT_MARK_IDLE = "bg-[rgba(242,244,252,.22)]";
/** Was `.watch-dot[aria-current="true"] .watch-dot-mark`. */
const WATCH_DOT_MARK_ACTIVE = "bg-[#F2F4FC] [transform:scale(1.3)]";

// The disclaimer line carries the physician caveat, so it sits one step above Label/quaternary —
// still receded, but actually legible on the true-black face.
const WATCH_FOOTER = [
  "flex-none px-[6px] py-[2px] text-center text-[8.5px] leading-[1.45] tracking-[.02em] text-[rgba(242,244,252,.45)]",
  "[@media(max-height:560px)]:text-[6.5px] [@media(max-height:560px)]:leading-[1.25]",
  "[.watch-screen_&]:px-[1cqw] [.watch-screen_&]:py-0 [.watch-screen_&]:text-[1.32cqw] [.watch-screen_&]:leading-[1.45]",
].join(" ");

/**
 * Original geometric glyphs for the four platters — one stroked path each, drawn for a 13px watch
 * tile. Deliberately NOT SF Symbols (that font ships under Apple's font licence and may not be
 * embedded); these are simple shapes in the metric's accent, `currentColor` from the tile.
 */
function VitalGlyph({ kind }: { kind: VitalKind }) {
  if (kind === "heartRate") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19.6 5.4 12.8a3.9 3.9 0 0 1 5.6-5.4l1 1 1-1a3.9 3.9 0 0 1 5.6 5.4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "spo2") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.6c3.3 3.6 5.2 6 5.2 8.5a5.2 5.2 0 0 1-10.4 0c0-2.5 1.9-4.9 5.2-8.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "respiration") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.8 13.4c2.1 0 2.1-4.4 4.2-4.4s2.1 4.4 4.2 4.4 2.1-4.4 4.2-4.4 2.1 4.4 4.2 4.4 1.4-1.6 1.4-1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.4 3.7a8.2 8.2 0 1 0 4.9 13.6 6.6 6.6 0 0 1-4.9-13.6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const locale = useLocale();
  const w = copy.watch;
  const reduceMotion = useReducedMotion();
  // Status word derived from the fixture before its parenthetical ("Stable (demo)" → "Stable").
  const healthStatus = DETAILS.health.value.split("(")[0]?.trim() ?? DETAILS.health.value;
  // Fixture message, first line only — clamped with ellipsis in CSS, never rewritten.
  const healthMessage = DETAILS.health.message.split("\n")[0] ?? DETAILS.health.message;
  const mission = DETAILS.mission.value; // Fixture: "ISS · Day 170" — English fixture, both locales.
  const monogram = astronautName?.trim().charAt(0).toUpperCase() || "+";

  const [active, setActive] = useState(0);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);

  // Status-bar clock (watchOS puts time top-right). Mount-gated: `/watch` is SSR, so the server and
  // the first client render both show the fixed "--:--" placeholder and the real time arrives in an
  // effect — no hydration mismatch, no layout shift (tabular-nums + 5ch floor). `h23` keeps the shape
  // at HH:MM for both locales (the fixture face has no room for an AM/PM suffix).
  const [clock, setClock] = useState<string | null>(null);
  useEffect(() => {
    const formatTime = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const tick = () => setClock(formatTime.format(new Date()));
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [locale]);

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

  const tiles: ReadonlyArray<{ kind: VitalKind; label: string; accent: string; aria: string; value: React.ReactNode }> = [
    {
      kind: "heartRate",
      label: w.vitalHeart,
      // watchOS 26 tokens.json — Apple Health red is Pink dark #FF375F (not Accents/Red #FF4245).
      accent: "text-[#FF375F]",
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
      // watchOS 26 tokens.json — Accents/Cyan dark #3CD3FE.
      accent: "text-[#3CD3FE]",
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
      // watchOS 26 tokens.json — Accents/Mint dark #00DAC3.
      accent: "text-[#00DAC3]",
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
      // watchOS 26 tokens.json — Accents/Indigo dark #6D7CFF.
      accent: "text-[#6D7CFF]",
      aria: "Sleep, demo value seven hours and forty-two minutes",
      value: (
        <>
          {VITAL_VALUES.sleepHours} <small>h</small> {VITAL_VALUES.sleepMinutes} <small>m</small>
        </>
      ),
    },
  ];

  const dotLabels = [w.screenVitals, w.screenWellness, w.screenSky];

  // Listening shows the mint dictation ring; an unavailable mic shows the orange accent instead.
  const micState =
    phase === "listening"
      ? "shadow-[0_0_0_4px_#00DAC3,0_0_26px_rgba(0,218,195,.5)]"
      : phase === "error"
        ? "shadow-[0_0_0_4px_#FF9230]"
        : "shadow-[0_2px_10px_rgba(0,0,0,.45)]";

  return (
    <section className={WATCH_HUD} aria-label="SKY astronaut wellness, watch view" onKeyDown={onKeyDown}>
      {/* Status block: crew monogram + clock, then one caption line (mission day · SIMULATED) */}
      <header className={WATCH_STATUS}>
        <div className={WATCH_STATUS_ROW}>
          <button
            type="button"
            className={WATCH_CREW}
            onClick={onSelectCrew}
            aria-label={astronautName ? `${copy.astronaut.change}: ${astronautName}` : w.selectCrew}
          >
            <span className={WATCH_CREW_MONOGRAM} aria-hidden="true">{monogram}</span>
            <span className={WATCH_CREW_NAME}>{astronautName ?? w.selectCrew}</span>
          </button>
          {/* Status bar time — decorative for assistive tech (the page has no schedule). */}
          <span className={WATCH_CLOCK} aria-hidden="true">{clock ?? "--:--"}</span>
        </div>
        <p className={WATCH_STATUS_CAPTION}>
          <span className={WATCH_MISSION}>{mission}</span>
          <span className={WATCH_TAG}>{w.simulated}</span>
        </p>
      </header>

      {/* Paged area — three screens, scroll-snap; dots and chevrons page them */}
      <div className={WATCH_PAGER}>
        <div className={WATCH_PAGES} ref={pagesRef}>
          {/* Screen 1 — Vitals: the 2×2 grid of platters, iOS-style taps into the shared detail dialog */}
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
                  <span className={WATCH_VITAL_LABEL}>
                    <span className={`${WATCH_VITAL_GLYPH} ${tile.accent}`} aria-hidden="true">
                      <VitalGlyph kind={tile.kind} />
                    </span>
                    {tile.label}
                  </span>
                  <span className={WATCH_VITAL_VALUE}>{tile.value}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Screen 2 — Wellness: fixture status, one line of fixture copy, one primary pill */}
          <section className={`${WATCH_PAGE} ${WATCH_PAGE_WELLNESS}`} role="region" aria-label={w.screenWellness}>
            <div className={WATCH_WELLNESS_GROUP}>
              <p className={WATCH_WELLNESS_CAPTION}>{DETAILS.health.title}</p>
              <p className={WATCH_WELLNESS_STATUS}>{healthStatus}</p>
              <p className={WATCH_WELLNESS_LINE}>{healthMessage}</p>
            </div>
            <button type="button" className={WATCH_VIEW_DETAILS} onClick={onHealth}>
              {w.viewDetails}
            </button>
          </section>

          {/* Screen 3 — Sky: dictation circle and the phase hint, nothing else */}
          <section className={`${WATCH_PAGE} ${WATCH_PAGE_SKY}`} role="region" aria-label={w.screenSky}>
            <p className={WATCH_SKY_CAPTION}>{w.speakToSky}</p>
            <button
              id="micButton"
              className={`${WATCH_MIC} ${micState}`}
              type="button"
              aria-label={MIC_ARIA[phase]}
              disabled={micDisabled}
              onClick={onToggleMic}
            >
              <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="8" width="12" height="24" rx="6" fill="none" stroke="currentColor" strokeWidth="2.6" /><path d="M13 23c0 14 22 14 22 0M24 35v6m-7 0h14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
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
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button
          type="button"
          className={`${WATCH_CHEVRON} ${WATCH_CHEVRON_NEXT}`}
          aria-label={w.screenNext}
          onClick={() => goTo(active + 1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
