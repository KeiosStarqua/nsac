// Tailwind v4 class strings for the `/` mock console ("SKY · Astronaut Wellness", features/hud-mock).
//
// Same visual language as the staged HUD (`features/sky-hud/hud-classes.ts`): deep navy stage,
// cyan/violet accents, glass panels. Two cascade facts carry over:
//   * `styles/global.css` resets are UNLAYERED and outrank `@layer utilities` — anything that must
//     beat `p`/`h1..h3` margins or `button{font:inherit}` carries the `!` suffix;
//   * below 1101px the screen is a real page and scrolls vertically: `overflow-x-hidden` is the
//     only horizontal rule, and the grid never widens past the viewport (`minmax(0,1fr)`);
//
// Grid behaviour (the ordered contract): three columns from 1101px (400 / flex / 560), the right
// column drops under the centre between 721 and 1100, and a single column below 721 — no horizontal
// scroll at any width.
//
// Vertical contract (2026-11-15): from 1101px the root is pinned to `h-dvh` with `overflow-hidden`,
// the grid is `flex-1 min-h-0` and each column is `min-h-0 overflow-y-auto`, so the document never
// scrolls — a too-short viewport degrades to per-column internal scroll instead. Below 1101px the
// page keeps the previous document flow. From 1101px the columns also distribute the free height:
// the vitals/trends cards on the left and the readiness-detail card on the right carry `flex-1
// min-h-0`, the centre column wraps the orb in a `flex-1 min-h-0` stage so free space hosts the orb,
// and card rows/bars spread with `justify-evenly` rather than top-packing.

export const MOCK_ROOT = [
  "relative isolate flex min-h-dvh w-full flex-col overflow-x-hidden min-[1101px]:h-dvh min-[1101px]:overflow-hidden",
  "text-[#edf8ff]",
  "[font-family:Inter,Manrope,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif]",
  "[font-synthesis:none]",
  "bg-[radial-gradient(ellipse_95%_90%_at_52%_-8%,#0c3159_0%,#091c32_49%,#04111f_78%,#010812_100%)]",
].join(" ");

export const MOCK_VIGNETTE =
  "pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,transparent_45%,rgba(2,7,18,.35)_88%,rgba(1,5,15,.6)_100%)]";

/** A card that absorbs its column's free height at ≥1101px (flex column so inner rows can spread). */
export const FILL_CARD =
  "flex flex-col min-[1101px]:min-h-0 min-[1101px]:flex-1";

/** Centre-column stage that hosts the orb in the free vertical space (≥1101px). */
export const ORB_STAGE =
  "relative grid w-full flex-1 min-h-0 place-items-center [transition:translate_.3s_ease,scale_.3s_ease] motion-reduce:transition-none";

/**
 * Chat-open variant of `ORB_STAGE`: the orb shrinks a little and lifts, leaving breathing room for
 * the floating chat card. Transform only (translate/scale) — the stage keeps its layout box, so the
 * greeting, grid and insight band do not reflow.
 */
export const ORB_STAGE_CHAT = `${ORB_STAGE} -translate-y-[4%] scale-[.85]`;

const FOCUS_RING = "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#f5fcff]!";

// ---- Header --------------------------------------------------------------------------------------

export const MOCK_HEADER = [
  "relative z-[3] flex w-full flex-wrap items-center justify-between gap-3 px-4 pt-3",
  "border-b border-[rgba(122,222,255,.12)] pb-3",
  "min-[1101px]:px-6",
].join(" ");

export const MOCK_HEADER_ACTIONS = "flex flex-wrap items-center gap-2 min-[721px]:gap-3";

export const MOCK_MISSION = [
  "inline-flex cursor-pointer items-center gap-[7px] rounded-full! border border-[rgba(122,222,255,.3)]",
  "bg-[rgba(11,36,58,.5)] px-[11px] py-[6px] text-[10px] font-medium tracking-[.14em] text-[#c8ecff]!",
  "[transition:border-color_.18s,background_.18s] hover:border-[#8ce7ff] hover:bg-[rgba(20,62,94,.55)]",
  FOCUS_RING,
].join(" ");

// ---- Layout --------------------------------------------------------------------------------------

export const MOCK_GRID = [
  "relative z-[2] mx-auto grid w-full max-w-[1720px] grid-cols-1 items-start gap-4 px-4 pb-[56px] pt-3",
  "min-[721px]:grid-cols-[minmax(0,400px)_minmax(0,1fr)]",
  "min-[721px]:[grid-template-areas:'left_center'_'right_right']",
  "min-[1101px]:grid-cols-[400px_minmax(0,1fr)_560px]",
  "min-[1101px]:[grid-template-areas:'left_center_right']",
  "min-[1101px]:gap-5 min-[1101px]:px-6",
  "min-[1101px]:flex-1 min-[1101px]:min-h-0 min-[1101px]:items-stretch",
].join(" ");

export const MOCK_LEFT = "flex min-w-0 flex-col gap-3 min-[721px]:[grid-area:left] min-[1101px]:min-h-0 min-[1101px]:overflow-x-clip min-[1101px]:overflow-y-auto";
export const MOCK_CENTER = "flex min-w-0 flex-col items-center gap-3 min-[721px]:[grid-area:center] min-[1101px]:min-h-0 min-[1101px]:overflow-x-clip min-[1101px]:overflow-y-auto";
export const MOCK_RIGHT = "flex min-w-0 flex-col gap-3 min-[721px]:[grid-area:right] min-[1101px]:min-h-0 min-[1101px]:overflow-x-clip min-[1101px]:overflow-y-auto";

// ---- Cards ---------------------------------------------------------------------------------------

export const CARD = [
  "relative rounded-[18px] border border-[rgba(122,222,255,.15)]",
  "bg-[linear-gradient(160deg,rgba(13,31,54,.86),rgba(7,18,33,.92))]",
  "p-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] backdrop-blur-[8px]",
].join(" ");

export const CARD_HEAD = "flex items-center justify-between gap-2";

export const CARD_TITLE =
  "m-0! text-[11px] font-medium uppercase tracking-[.2em] text-[#a8d8f0]";

export const TAG =
  "flex-none rounded-full border border-[rgba(122,222,255,.28)] bg-[rgba(11,36,58,.55)] px-[9px] py-[3px] text-[9px] uppercase tracking-[.14em] text-[#8fb8d4]";

export const TAG_ACCENT =
  "flex-none rounded-full border border-[rgba(94,234,212,.34)] bg-[rgba(94,234,212,.1)] px-[9px] py-[3px] text-[9px] uppercase tracking-[.14em] text-[#8ef0d9]";

export const MUTED = "text-[#8ba9be]";

// ---- Vitals + trends -----------------------------------------------------------------------------

export const VITAL_ROW = [
  "grid grid-cols-[26px_minmax(0,1fr)_auto_66px] items-center gap-[10px] py-[5px]",
  "border-b border-[rgba(122,222,255,.08)] last:border-b-0",
].join(" ");

export const VITAL_ICON = "size-[26px] flex-none text-[#7fe0ff] [&_svg]:size-full";

export const VITAL_LABEL = "m-0! min-w-0 truncate text-[12px] font-light text-[#cfe4f4]";

export const VITAL_VALUE =
  "whitespace-nowrap text-right text-[13px] font-light tabular-nums text-[#eaf8ff] [&_small]:ml-[2px] [&_small]:text-[10px] [&_small]:text-[#9dc4d8]";

/** The per-row inline sparkline (36px tall, 66px wide — the reference mock's proportion). */
export const VITAL_SPARK = "block h-[26px] w-[66px] [filter:drop-shadow(0_0_4px_rgba(94,234,212,.35))]";

export const TREND_BLOCK =
  "flex flex-col gap-[6px] border-b border-[rgba(122,222,255,.08)] py-[7px] last:border-b-0 last:pb-0";

export const TREND_HEAD = "flex items-center justify-between gap-2";

export const TREND_LABEL = "m-0! text-[11.5px] font-light text-[#cfe4f4]";

export const TREND_CAPTION = "text-[11px] tabular-nums text-[#8ef0d9]";

export const TREND_SPARK = "block h-[24px] w-full";

/** Segmented sleep bar: five blocks whose relative widths come from the fixture. */
export const SLEEP_BAR = "flex h-[18px] w-full gap-[3px] overflow-hidden rounded-[5px]";

export const SLEEP_BLOCK = "h-full rounded-[3px] bg-[linear-gradient(180deg,#a78bfa,#7c5cf0)]";

export const ACTIVITY_BARS = "flex h-[24px] items-end gap-[2px]";

export const ACTIVITY_BAR = "min-w-[2px] flex-1 rounded-[1px] bg-[linear-gradient(180deg,#5eead4,#2f9fd0)]";

// ---- Profile -------------------------------------------------------------------------------------

export const PROFILE_ROW = "flex items-center gap-3";

export const AVATAR = [
  "relative grid size-[52px] flex-none place-items-center overflow-hidden rounded-full border",
  "border-[rgba(94,234,212,.45)] bg-[rgba(7,18,33,.9)]",
  "shadow-[0_0_22px_-4px_rgba(94,234,212,.45)]",
].join(" ");

export const AVATAR_IMG = "h-full w-full object-cover [transform:scale(1.02)]";

export const AVATAR_INITIALS = "text-[18px] font-semibold tracking-[.08em] text-[#8ef0d9]";

export const PROFILE_NAME =
  "m-0! overflow-hidden text-ellipsis whitespace-nowrap! text-[17px] font-light leading-tight text-[#f2fbff]";

export const PROFILE_ROLE =
  "m-0! overflow-hidden text-ellipsis whitespace-nowrap! text-[10px] uppercase tracking-[.12em] text-[#8fb8d4]";

export const CHANGE_BUTTON = [
  "mt-[6px] w-fit flex-none cursor-pointer rounded-full! border border-[rgba(122,222,255,.3)] bg-transparent",
  "px-[9px] py-[3px] text-[8.5px] uppercase tracking-[.12em] text-[#aee6ff]!",
  "[transition:border-color_.18s,background_.18s] hover:border-[#8ce7ff] hover:bg-[rgba(20,62,94,.4)]",
  FOCUS_RING,
].join(" ");

// ---- Voice column --------------------------------------------------------------------------------

export const ORB_ZONE = [
  "relative aspect-square w-[min(100%,clamp(220px,36dvh,420px))]",
  "[filter:drop-shadow(0_0_26px_rgba(68,172,255,.24))]",
  "[&_canvas]:relative [&_canvas]:z-[2] [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full",
  "min-[721px]:max-[1100px]:w-[min(100%,320px)]",
  "max-[720px]:w-[min(72vw,300px)]",
  "max-[420px]:w-[min(64vw,240px)]",
].join(" ");

export const ORB_ZONE_THINKING = "[filter:drop-shadow(0_0_34px_rgba(171,142,255,.33))]";

export const GREETING = [
  "m-0! text-center text-[clamp(19px,2vw,28px)] font-light leading-[1.25] tracking-[.013em] text-[#ecf7ff]",
  "[text-shadow:0_2px_23px_rgba(10,25,62,.6)]",
].join(" ");

export const PROMPT = [
  "m-0! mt-[6px] text-center text-[clamp(14px,1.3vw,17px)] font-light text-[#b7c6db]",
].join(" ");

export const VOICE_CONTROL = "flex w-full flex-col items-center";

export const VOICE_HINT = [
  "mt-[8px] inline-flex items-center gap-[9px] whitespace-nowrap text-[15px] font-light text-[#f0f7ff]",
  "[text-shadow:0_0_14px_rgba(88,232,211,.28)]",
  "max-[720px]:text-[13px]",
].join(" ");

export const VOICE_CLUSTER =
  "flex flex-col items-center [transition:opacity_.24s_ease,scale_.24s_ease,translate_.24s_ease] motion-reduce:transition-none";

/**
 * Chat-open state of `VOICE_CLUSTER`: the whole voice control fades out and settles back a touch.
 * The cluster stays in the layout (transform/opacity only), so nothing jumps; the host also marks it
 * `inert` + `aria-hidden`, and `pointer-events-none` keeps the vanishing pill from taking clicks.
 */
export const VOICE_CLUSTER_HIDDEN = "pointer-events-none scale-[.92] opacity-0 select-none -translate-y-[6px]";

// ---- Readiness -----------------------------------------------------------------------------------

export const GAUGE_WRAP = "relative size-[104px] flex-none";

export const GAUGE_CENTER =
  "absolute inset-0 grid place-items-center text-[30px] font-light leading-none tabular-nums text-[#f2fbff]";

export const GAUGE_SLASH = "ml-[1px] text-[11px] font-light text-[#8fb8d4]";

export const READINESS_STATUS =
  "text-[15px] font-light leading-none text-[#60efc0] [text-shadow:0_0_18px_rgba(72,244,198,.25)]";

export const EYEBROW = "text-[9px] uppercase tracking-[.2em] text-[#7f9db4]";

// ---- Tabs ----------------------------------------------------------------------------------------

export const TABS = [
  "inline-flex w-full flex-wrap items-center gap-[4px] rounded-full border border-[rgba(122,222,255,.16)]",
  "bg-[rgba(7,18,33,.6)] p-[3px]",
].join(" ");

const TAB_BASE = [
  "flex-1 cursor-pointer rounded-full! border border-transparent bg-transparent px-[10px] py-[6px]",
  "text-[10px] uppercase tracking-[.12em] whitespace-nowrap text-[#8fb8d4]!",
  "[transition:border-color_.18s,background_.18s,color_.18s] hover:text-[#d4f4ff]!",
  FOCUS_RING,
].join(" ");

export const TAB_ACTIVE =
  "border-[rgba(140,231,255,.5)] bg-[rgba(120,234,255,.12)] text-[#d9f6ff]! shadow-[inset_0_0_0_1px_rgba(140,231,255,.25)]";

export function tabClass(active: boolean): string {
  return active ? `${TAB_BASE} ${TAB_ACTIVE}` : TAB_BASE;
}

// ---- Tab panel -----------------------------------------------------------------------------------

export const PANEL_BODY =
  "grid grid-cols-[minmax(132px,176px)_minmax(0,1fr)] items-center gap-3 min-[1101px]:min-h-0 min-[1101px]:flex-1 min-[1101px]:items-stretch max-[430px]:grid-cols-1";

export const HOLO_FRAME = [
  "relative aspect-[2/3] w-full max-[1100px]:max-h-[min(210px,24dvh)] overflow-hidden rounded-[14px]",
  "border border-[rgba(122,222,255,.14)] bg-[radial-gradient(ellipse_at_50%_38%,rgba(41,207,246,.14),rgba(9,27,48,.5)_70%,transparent_100%)]",
  "min-[1101px]:h-[clamp(150px,26dvh,320px)] min-[1101px]:max-h-none min-[1101px]:max-w-full",
  "max-[430px]:mx-auto max-[430px]:max-h-[180px] max-[430px]:w-[140px]",
].join(" ");

// Button path of the Body-tab hologram frame: same dimensions as HOLO_FRAME plus cursor, a subtle
// border/glow shift on hover/active (no layout movement) and a brand-cyan focus-visible ring.
export const HOLO_FRAME_BUTTON = [
  "block cursor-pointer p-0!",
  "[transition:border-color_.18s,box-shadow_.18s]",
  "hover:border-[rgba(94,234,212,.4)] hover:shadow-[0_0_18px_rgba(94,234,212,.22)]",
  "active:border-[rgba(94,234,212,.6)] active:shadow-[0_0_10px_rgba(94,234,212,.3)]",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#5eead4]!",
].join(" ");

export const ROW_LIST = "m-0! flex min-h-0 flex-1 list-none flex-col justify-evenly gap-[9px] p-0!";

export const ROW = "flex flex-col gap-[5px]";

export const ROW_HEAD = "flex items-center gap-[7px]";

export const ROW_ICON = "size-[14px] flex-none text-[#7fe0ff]";

export const ROW_LABEL = "m-0! min-w-0 truncate text-[11px] font-light text-[#b9d3e6]";

export const ROW_VALUE = "ml-auto whitespace-nowrap text-[12px] font-light tabular-nums text-[#eaf8ff]";

export const ROW_BAR_TRACK = "h-[3px] w-full overflow-hidden rounded-full bg-[rgba(122,222,255,.14)]";

export const ROW_BAR_FILL =
  "block h-full rounded-full bg-[linear-gradient(90deg,#5eead4,#7ab8ff_70%,#a78bfa)]";

// ---- Mini metric cards ---------------------------------------------------------------------------

export const MINI_GRID = "grid grid-cols-3 gap-2 max-[520px]:grid-cols-1";

export const MINI_CARD = [
  "flex min-w-0 flex-col gap-[4px] rounded-[14px] border border-[rgba(122,222,255,.14)]",
  "bg-[rgba(9,24,42,.7)] p-[11px]",
].join(" ");

export const MINI_LABEL =
  "m-0! flex items-center gap-[6px] text-[9.5px] uppercase tracking-[.14em] text-[#8fb8d4] [&_svg]:size-[12px] [&_svg]:text-[#7fe0ff]";

export const MINI_VALUE = "text-[19px] font-light leading-none tabular-nums text-[#f2fbff]";

export const MINI_UNIT = "ml-[3px] text-[10px] font-light text-[#8fb8d4]";

export const MINI_DELTA = "text-[10px] tabular-nums text-[#8ef0d9]";

export const MINI_CHIP =
  "mt-[2px] w-fit rounded-full border border-[rgba(163,230,53,.35)] bg-[rgba(163,230,53,.1)] px-[7px] py-[2px] text-[9px] tabular-nums text-[#c8f79a]";

// ---- Insight band --------------------------------------------------------------------------------

export const INSIGHT_BAND = [
  "flex w-full cursor-pointer items-center gap-3 rounded-full! border border-[rgba(122,222,255,.24)]",
  "bg-[linear-gradient(100deg,rgba(13,40,66,.9),rgba(21,26,58,.9))] px-4 py-[10px] text-left text-[#eaf8ff]",
  "shadow-[0_0_24px_-8px_rgba(94,234,212,.45)]",
  "[transition:border-color_.18s,background_.18s,translate_.3s_ease,opacity_.3s_ease] hover:border-[rgba(139,233,255,.6)]",
  FOCUS_RING,
].join(" ");

/**
 * Chat-open state of the insight band: it slides down out of the way (plus a fade) so the floating
 * chat card can rise from the bottom. Transform/opacity only — the band keeps its layout box, so the
 * centre column does not reflow; the host also marks it `inert` + `aria-hidden` (no tab stop, no
 * click) and `pointer-events-none`.
 */
export const INSIGHT_BAND_DISMISSED = "pointer-events-none translate-y-[115%] opacity-0 select-none";

/**
 * The insight band's dock: a full-width box of exactly the band's height that clips its downward
 * slide, so the exit never adds scrollable overflow to the centre column (`overflow-y-auto` there
 * would grow a scrollbar and shift the whole column by 15px). The band therefore sinks out of view
 * at the dock's bottom edge while it fades — no height change, no grid reflow, identical at rest.
 */
export const INSIGHT_BAND_DOCK = "w-full [overflow:clip]";

export const INSIGHT_ICON = "size-[18px] flex-none text-[#8ef0d9]";

export const INSIGHT_TEXT = "m-0! min-w-0 text-[12.5px] font-light leading-snug text-[#dcecff]";

export const INSIGHT_KICKER = "mt-[2px] block text-[9px] uppercase tracking-[.16em] text-[#7f9db4]";

export const INSIGHT_CHEVRON = "ml-auto size-[18px] flex-none text-[#8ef0d9]";

// ---- Footer --------------------------------------------------------------------------------------

export const FOOTER = [
  "pointer-events-none absolute inset-x-0 bottom-0 z-[3] flex items-center justify-between gap-3",
  "px-4 py-2 min-[1101px]:px-6",
].join(" ");

export const FOOTER_NOTE = "m-0! text-[10px] tracking-[.04em] text-[rgba(168,187,206,.62)]";

export const SIMULATED_CHIP = [
  "pointer-events-auto flex-none rounded-full border border-[rgba(122,222,255,.24)]",
  "bg-[rgba(7,18,33,.8)] px-[10px] py-[4px] text-[8.5px] uppercase tracking-[.16em] text-[#8fb8d4]",
].join(" ");
