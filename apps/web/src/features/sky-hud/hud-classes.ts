// Tailwind v4 class strings for the SKY HUD stage (1672×941) and its watch frame — the HUD's old
// hand-written stylesheets, expressed as utilities. SkyScreen (staged), the hud-gen catalog and the
// watch frame render the same projections, so the strings live in one place to keep them identical.
//
// Two cascade facts shape every string here:
//   * `styles/global.css` resets are UNLAYERED, so they outrank `@layer utilities` whatever the
//     specificity: p/h1/h2/h3 margins, heading letter-spacing/line-height, `button{font:inherit}`,
//     `a{color}` and `:focus-visible{outline…}`. Utilities that must beat them carry the `!`
//     important suffix.
//   * the watch face is entered with the `[.watch-screen_&]` arbitrary variant, whose specificity
//     (0,2,0) reproduces the old `.watch-screen …` descendant selectors — including winning over
//     the ≤480px and short-viewport media variants, exactly as the old files did.
//
// Keyframes (orbBreath, chestGlow, fluidFlow, fluidFloat, micPulse) stay in `hud-keyframes.css`.
import type { VoicePhase } from "./types";

/** Console-wide focus ring (was `button:focus-visible,input:focus-visible` in hud-screen.css). */
const FOCUS_RING = "focus-visible:outline-2! focus-visible:outline-offset-[5px]! focus-visible:outline-[#f5fcff]!";

// ---- Stage -----------------------------------------------------------------------------------------

export const SKY_APP = [
  "relative isolate h-dvh min-h-[560px] w-full overflow-hidden max-[720px]:min-h-[640px] max-[480px]:min-h-dvh",
  "text-[#edf8ff]",
  "[font-family:Inter,Manrope,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif]",
  "[font-synthesis:none]",
  "bg-[radial-gradient(ellipse_90%_95%_at_52%_48%,#0c3159_0%,#091c32_49%,#04111f_76%,#010812_100%)]",
].join(" ");

export const SPACE_ART = "pointer-events-none absolute inset-0 [&_svg]:block [&_svg]:h-full [&_svg]:w-full";

export const SPACE_VIGNETTE =
  "pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_70%_80%_at_53%_41%,transparent_48%,rgba(2,7,18,.3)_84%,rgba(1,5,15,.65)_100%)]";

// ---- Header ----------------------------------------------------------------------------------------

export const SKY_HEADER = [
  "pointer-events-none absolute top-[2.2%] right-[2.7%] left-[3.1%] z-[15] flex items-start justify-between",
  "max-[1000px]:top-[3%] max-[1000px]:right-[4%] max-[1000px]:left-[4%]",
  "max-[720px]:top-[18px] max-[720px]:right-[19px] max-[720px]:left-[19px]",
].join(" ");

export const SKY_HEADER_ACTIONS = "pointer-events-auto flex items-start gap-[14px] max-[1000px]:gap-[8px]";

export const BRAND = `pointer-events-auto flex cursor-pointer items-center gap-[22px] border-0 bg-transparent p-0 text-left text-inherit max-[720px]:gap-[10px] ${FOCUS_RING}`;

export const BRAND_RING = [
  "relative block size-[57px] rounded-full border-[3px] border-transparent",
  "[background:linear-gradient(#09192c,#09192c)_padding-box,conic-gradient(from_55deg,transparent_8%,#8defff_28%,#a4aaff_50%,#fff_70%,#8ca6ff_82%,transparent_100%)_border-box]",
  "shadow-[0_0_18px_rgba(105,192,255,.26),inset_0_0_9px_rgba(108,156,255,.16)]",
  "max-[1000px]:size-[45px] max-[720px]:size-[37px] max-[720px]:border-2",
].join(" ");

export const BRAND_COPY = "flex flex-col gap-[3px]";

export const BRAND_NAME = [
  "text-[29px] font-light leading-[1.14] tracking-[.14em]",
  "[&_.depth-text]:leading-[1.14]! [&_.depth-text]:tracking-[.14em]!",
  "max-[1000px]:text-[24px] max-[720px]:text-[20px]",
].join(" ");

export const BRAND_TAGLINE =
  "whitespace-nowrap text-[17px] font-light text-[#9bb0c8] max-[1000px]:text-[12px] max-[720px]:text-[10px]";

export const MISSION_TRIGGER = [
  "pointer-events-auto relative flex min-w-[226px] cursor-pointer items-center justify-end gap-[12px] border-0 bg-transparent",
  "pt-[5px] pr-0 pb-[24px] pl-[12px] text-inherit",
  "max-[720px]:min-w-0 max-[720px]:gap-[3px] max-[720px]:pt-[1px] max-[720px]:pb-[12px] max-[720px]:pl-0",
  FOCUS_RING,
].join(" ");

export const STATION_ICON =
  "block h-[35px] w-[48px] [transform:rotate(-10deg)] text-[#c0d5f0] [&_svg]:h-full [&_svg]:w-full max-[720px]:h-[25px] max-[720px]:w-[28px]";

export const MISSION_TEXT = "whitespace-nowrap text-[16px] font-light max-[720px]:text-[11px] max-[420px]:text-[10px]";

export const MISSION_UNDERLINE = [
  "absolute right-[2px] bottom-[2px] h-[17px] w-[235px] rounded-[50%] border-t border-transparent [transform:rotate(-5deg)]",
  "[background:linear-gradient(95deg,#65deff,transparent)_top/100%_1px_no-repeat] opacity-80",
  "max-[720px]:w-[128px]",
].join(" ");

// ---- Vitals ----------------------------------------------------------------------------------------

export const VITALS_PROJECTION = [
  "absolute left-[5.1%] top-[12.1%] z-[8] h-[322px] w-[310px]",
  "max-[1300px]:[transform:scale(.86)] max-[1300px]:[transform-origin:top_left]",
  "max-[1000px]:left-[2%] max-[1000px]:top-[15%] max-[1000px]:[transform:scale(.69)]",
  "max-[720px]:left-[4%] max-[720px]:top-[14%] max-[720px]:[transform:scale(.52)]",
  "max-[420px]:left-[-4%] max-[420px]:top-[12%] max-[420px]:[transform:scale(.44)]",
].join(" ");

export const VITALS_SHIELD = [
  "absolute -z-[1] left-0 top-0 h-[315px] w-[295px] [transform:rotate(9deg)]",
  "[border-radius:64%_40%_40%_55%/47%_55%_40%_50%]",
  "border-l-2 border-t border-l-[rgba(88,230,255,.64)] border-t-[rgba(99,217,255,.25)]",
  "bg-[radial-gradient(ellipse_at_28%_65%,rgba(41,207,246,.12),rgba(27,84,137,.055)_53%,transparent_73%)]",
  "shadow-[inset_22px_3px_55px_rgba(16,163,216,.075),-6px_0_23px_rgba(72,195,242,.13)]",
].join(" ");

export const VITAL_TILE = [
  "flex h-[67px] w-max cursor-pointer items-center gap-[16px] border-0 bg-transparent px-[9px] py-0 text-left text-[#edf8ff]",
  "[transition:transform_.2s,filter_.2s] hover:brightness-[1.3] hover:[transform:translateX(7px)]",
  "[&:nth-of-type(1)]:mt-[28px] [&:nth-of-type(1)]:ml-[86px] [&:nth-of-type(2)]:ml-[56px] [&:nth-of-type(3)]:ml-[39px] [&:nth-of-type(4)]:ml-[55px]",
  "[&:last-of-type_.vital-icon]:after:border-[#c19dfd] [&:last-of-type_.vital-icon]:after:drop-shadow-[0_0_5px_#af8dff] [&:last-of-type_.vital-icon]:text-[#f0d1ff]",
  FOCUS_RING,
].join(" ");

export const VITAL_ICON = [
  // `vital-icon` is the hook for the tile's `[&:last-of-type_.vital-icon]` lilac accent.
  "vital-icon relative flex size-[58px] flex-none items-center justify-center rounded-full text-[#b2efff]",
  "bg-[radial-gradient(circle_at_50%_50%,rgba(76,207,255,.12),rgba(38,90,146,.04)_75%)]",
  "shadow-[inset_0_0_20px_rgba(126,216,255,.08)]",
  "[&_svg]:size-[44px]",
  "after:absolute after:bottom-[2px] after:left-[12px] after:h-[14px] after:w-[35px] after:rounded-[0_0_50%_50%]",
  "after:border-b-[3px] after:border-b-[#5eeaff] after:drop-shadow-[0_0_6px_#31cbff] after:content-['']",
].join(" ");

export const VITAL_ICON_OXYGEN =
  "text-[25px] font-light tracking-[-.06em] [&_sub]:mt-[15px] [&_sub]:self-center [&_sub]:text-[12px]";

export const VITAL_VALUE =
  "whitespace-nowrap text-[25px] font-light tracking-[-.02em] [&_small]:ml-[1px] [&_small]:text-[14px] [&_small]:font-light";

export const DEMO_INDICATOR =
  "absolute left-[50px] top-[313px] text-[9px] tracking-[.16em] text-[rgba(184,229,245,.5)] max-[720px]:hidden";

// ---- Conversation ----------------------------------------------------------------------------------

export const CONVERSATION = "pointer-events-none absolute inset-0 z-[7]";

export const CONVERSATION_LENS = [
  "absolute left-[24.4%] top-[28%] h-[35%] w-1/2 [border-radius:53%_47%_49%_51%/56%_50%_50%_44%] [transform:rotate(-4deg)]",
  "border-b border-l border-r border-b-[rgba(66,163,236,.18)] border-l-[rgba(87,141,255,.5)] border-r-[rgba(186,162,255,.38)]",
  "bg-[linear-gradient(120deg,rgba(45,104,231,.1),rgba(53,188,242,.058)_54%,rgba(197,124,248,.09))]",
  "shadow-[inset_22px_13px_48px_rgba(30,79,146,.07),inset_-15px_-16px_30px_rgba(179,100,245,.055),0_0_50px_rgba(61,113,229,.045)]",
  "max-[1300px]:left-[22%] max-[1300px]:w-[54%]",
  "max-[1000px]:left-[17%] max-[1000px]:top-[34%] max-[1000px]:h-[31%] max-[1000px]:w-[65%]",
  "max-[720px]:left-[5%] max-[720px]:top-[31%] max-[720px]:h-[36%] max-[720px]:w-[90%]",
].join(" ");

/** `listening` widens the lens rim (was `.sky-app[data-phase="listening"] .conversation-lens`). */
export const CONVERSATION_LENS_LISTENING = "border-[rgba(86,229,255,.44)]!";

export const LENS_INNER = [
  "absolute inset-[13%_0_5%] [border-radius:60%_45%_50%_50%]",
  "border-b border-b-[rgba(87,177,242,.08)]",
  "bg-[radial-gradient(ellipse_at_50%_66%,rgba(77,191,247,.035),transparent_65%)]",
].join(" ");

export const ORB_ZONE = [
  "absolute left-[50.6%] top-[26.3%] aspect-square w-[min(26vw,355px)]",
  "[filter:drop-shadow(0_0_26px_rgba(68,172,255,.24))] [transform:translate(-50%,-50%)]",
  "[&_canvas]:relative [&_canvas]:z-[2] [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full",
  "max-[1300px]:top-[27.5%]",
  "max-[1000px]:top-[31%] max-[1000px]:w-[310px]",
  "max-[720px]:left-1/2 max-[720px]:top-[35%] max-[720px]:w-[min(68vw,290px)]",
  "max-[420px]:top-[35%]",
].join(" ");

/** `thinking` deepens the orb halo (was `.sky-app[data-phase="thinking"] .orb-zone`). */
export const ORB_ZONE_THINKING = "[filter:drop-shadow(0_0_34px_rgba(171,142,255,.33))]";

export const ORB_FALLBACK = [
  "absolute inset-[18%] rounded-full",
  "bg-[radial-gradient(circle_at_65%_60%,transparent_20%,rgba(59,174,238,.1)_40%,rgba(120,225,255,.42)_70%,rgba(170,156,252,.2)_79%,transparent_90%)]",
  "shadow-[0_0_30px_rgba(83,200,248,.2),inset_-9px_4px_20px_rgba(133,178,255,.45)]",
  "[animation:orbBreath_6s_ease-in-out_infinite] motion-reduce:animate-none!",
].join(" ");

export const CONVERSATION_COPY = [
  "absolute left-[23%] top-[40%] w-[56%] text-center [text-shadow:0_2px_23px_rgba(10,25,62,.6)]",
  "[&_h1]:[margin:0_0_8px]! [&_h1]:text-[clamp(25px,2.7vw,44px)] [&_h1]:font-light [&_h1]:leading-[1.25]! [&_h1]:tracking-[.013em]! [&_h1]:whitespace-normal",
  "[&_p]:text-[clamp(17px,1.65vw,28px)] [&_p]:font-light [&_p]:tracking-[.008em] [&_p]:text-[#b7c6db]",
  "max-[1300px]:top-[41.5%]",
  "max-[1000px]:left-[20%] max-[1000px]:top-[46%] max-[1000px]:w-[60%] max-[1000px]:[&_h1]:text-[30px]",
  "max-[720px]:left-[5%] max-[720px]:top-[52%] max-[720px]:w-[90%] max-[720px]:[&_h1]:text-[clamp(22px,6vw,31px)] max-[720px]:[&_p]:text-[16px]",
  "max-[420px]:top-[51%] max-[420px]:[&_h1]:text-[23px]",
].join(" ");

export const VOICE_WAVEFORM =
  "absolute left-[50.6%] top-[52.2%] h-[74px] w-[min(23vw,310px)] overflow-visible [transform:translate(-50%,0)] max-[1000px]:top-[57%] max-[1000px]:w-[235px] max-[720px]:top-[61%] max-[720px]:w-[220px]";

export const CAPTIONS = [
  "absolute left-[25%] top-[60%] w-[52%] text-center text-[14px] text-[#caecff]",
  "[text-shadow:0_0_16px_rgba(44,194,245,.4)]",
  "max-[720px]:top-[67%]",
  "max-[480px]:left-[4%] max-[480px]:w-[92%]",
].join(" ");

// ---- Health ----------------------------------------------------------------------------------------

export const HEALTH_PROJECTION = [
  "absolute right-[5%] top-[13.1%] z-[8] h-[272px] w-[335px]",
  "max-[1300px]:right-[3%] max-[1300px]:[transform:scale(.88)] max-[1300px]:[transform-origin:top_right]",
  "max-[1000px]:right-[1%] max-[1000px]:top-[14%] max-[1000px]:[transform:scale(.7)]",
  "max-[720px]:right-[-13%] max-[720px]:top-[15%] max-[720px]:[transform:scale(.48)]",
  "max-[420px]:right-[-24%] max-[420px]:top-[12%] max-[420px]:[transform:scale(.43)]",
].join(" ");

export const HEALTH_SHIELD = [
  "absolute inset-[0_2px_0_0] [border-radius:57%_43%_51%_49%/49%_50%_50%_51%]",
  "border-b border-l border-t border-b-[rgba(113,219,255,.39)] border-l-[rgba(89,173,244,.18)] border-t-[rgba(129,207,255,.35)]",
  "bg-[radial-gradient(ellipse_at_29%_42%,rgba(54,177,229,.14),rgba(24,70,121,.09)_55%,rgba(23,64,98,.02)_80%)]",
  "shadow-[inset_0_5px_36px_rgba(104,184,242,.09)]",
].join(" ");

export const HOLOGRAM_LINK =
  `absolute left-[11%] top-[13%] h-[86%] w-[37%] border-0 bg-transparent p-0 hover:brightness-150 ${FOCUS_RING}`;

export const HUMAN_HOLOGRAM = "h-full w-full [filter:drop-shadow(0_0_7px_rgba(83,198,255,.7))]";

export const CHEST_GLOW = "[transform-origin:center] [animation:chestGlow_5s_ease-in-out_infinite] motion-reduce:animate-none!";

export const HEALTH_SUMMARY =
  `absolute left-[53%] top-[29%] flex cursor-pointer flex-col items-start gap-[6px] border-0 bg-transparent p-0 text-left text-[#edf8ff] ${FOCUS_RING}`;

export const HEALTH_LABEL = "text-[17px] font-light";

export const HEALTH_STATUS =
  "text-[35px] font-light leading-[1.1] text-[#60efc0] [text-shadow:0_0_23px_rgba(72,244,198,.24)]";

export const HEALTH_GUIDANCE = "mt-[8px] whitespace-nowrap text-[14px] font-light leading-[1.5]";

export const HEALTH_DEMO = "mt-[7px] text-[9px] tracking-[.12em] text-[#a6d9d4] opacity-[.62]";

// ---- Fluid input surface + voice control -----------------------------------------------------------

export const INPUT_PROJECTION = [
  "pointer-events-none absolute left-[21.5%] top-[66.5%] z-[6] h-[23.5%] w-[62%]",
  "[filter:drop-shadow(0_12px_30px_rgba(70,155,255,.15))] [&_svg]:h-full [&_svg]:w-full [&_svg]:overflow-visible",
  "max-[1000px]:left-[13%] max-[1000px]:top-[72%] max-[1000px]:w-[74%]",
  "max-[720px]:left-[1%] max-[720px]:top-[75%] max-[720px]:h-[18%] max-[720px]:w-[98%]",
].join(" ");

export const FLUID_WAVE =
  "[transform-origin:center] [animation:fluidFlow_8s_ease-in-out_infinite_alternate] motion-reduce:animate-none!";

export const FLUID_WAVE_TWO = "[animation-delay:-3s]";

export const FLUID_SHEET =
  "[transform-origin:center] [animation:fluidFloat_9s_ease-in-out_infinite_alternate] motion-reduce:animate-none!";

export const VOICE_CONTROL =
  "absolute left-1/2 top-[65.5%] z-[12] flex min-w-[250px] flex-col items-center gap-0 [transform:translateX(-50%)] max-[1000px]:top-[71%] max-[720px]:top-[75%]";

export const VOICE_HINT = [
  "mt-[40px] whitespace-nowrap text-[20px] font-light text-[#f0f7ff] [text-shadow:0_0_12px_rgba(80,183,255,.2)]",
  "max-[1000px]:mt-[25px]",
  "max-[720px]:mt-[15px] max-[720px]:text-[16px]",
  "max-[480px]:max-w-full max-[480px]:whitespace-normal max-[480px]:text-center",
].join(" ");

export const TEXT_TRIGGER = [
  "mt-[13px] cursor-pointer border-0 bg-transparent px-[12px] py-[6px]",
  "text-[11px]! tracking-[.08em] text-[rgba(177,224,247,.55)] hover:text-[#d4faff]",
  FOCUS_RING,
].join(" ");

/**
 * Microphone orb, shared by the console and the watch. `size` is baked in per call site so the
 * console's fixed 84px orb and the watch's 30vw orb never collide on width/height utilities.
 */
const MIC_BASE = [
  "grid cursor-pointer place-items-center rounded-full! border",
  "bg-transparent",
  "text-[#ebfaff]",
  "bg-[radial-gradient(circle_at_50%_47%,rgba(42,175,251,.47),rgba(38,124,235,.17)_50%,rgba(14,51,125,.15)_74%,rgba(93,226,255,.16))]",
  "shadow-[inset_0_0_16px_rgba(92,218,255,.47),0_0_10px_rgba(129,227,255,.8),0_0_34px_rgba(64,144,253,.53)]",
  "[transition:transform_.2s,box-shadow_.3s]",
  "hover:[transform:scale(1.06)]",
  "hover:shadow-[inset_0_0_20px_rgba(88,224,255,.55),0_0_24px_rgba(99,230,255,.9),0_0_48px_rgba(52,128,253,.5)]",
  "disabled:cursor-wait",
  "[&_svg]:[filter:drop-shadow(0_0_6px_rgba(255,255,255,.6))]",
  FOCUS_RING,
].join(" ");

export function micButtonClass(phase: VoicePhase, size: "console" | "watch"): string {
  const rim = phase === "error" ? "border-[#f8b89d]" : "border-[rgba(153,248,255,.95)]";
  // Was `.sky-app[data-phase="listening"] .mic-button`.
  const pulse = phase === "listening" ? "[animation:micPulse_1.8s_ease-in-out_infinite] motion-reduce:animate-none!" : "";
  const dims =
    size === "console"
      ? "size-[84px] [&_svg]:size-[39px] max-[720px]:size-[70px]"
      : "h-[30vw] w-[30vw] min-h-[104px] min-w-[104px] [&_svg]:h-[45%] [&_svg]:w-[45%] [@media(max-height:560px)]:min-h-[72px] [@media(max-height:560px)]:min-w-[72px] [.watch-screen_&]:size-[30cqw] [.watch-screen_&]:min-h-0 [.watch-screen_&]:min-w-0 [.watch-screen_&]:[&_svg]:h-[45%] [.watch-screen_&]:[&_svg]:w-[45%]";
  return [MIC_BASE, rim, dims, pulse].filter(Boolean).join(" ");
}

// ---- Header chrome: spacecraft chip + Console | Watch switcher --------------------------------------

export const SPACECRAFT_LINK = [
  "mt-[3px] inline-flex cursor-pointer items-center gap-[9px] rounded-full! border no-underline backdrop-blur-[6px]",
  "border-[rgba(122,222,255,.35)] bg-[rgba(11,36,58,.5)] px-[13px] py-[8px]",
  "text-[10px] font-medium tracking-[.22em] indent-[.22em] whitespace-nowrap text-[#aee6ff]!",
  "[transition:border-color_.18s,background_.18s,box-shadow_.18s,color_.18s]",
  "hover:border-[#8ce7ff] hover:bg-[rgba(20,62,94,.55)] hover:text-[#e6fbff]! hover:shadow-[0_0_16px_rgba(105,214,255,.28)]",
  "[&_svg]:block [&_svg]:h-[13px] [&_svg]:w-[26px]",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#f5fcff]!",
  "max-[1000px]:mt-[2px] max-[1000px]:gap-[6px] max-[1000px]:px-[9px] max-[1000px]:py-[6px] max-[1000px]:text-[9px] max-[1000px]:[&_svg]:h-[11px] max-[1000px]:[&_svg]:w-[21px]",
  "max-[720px]:mt-[1px] max-[720px]:px-[8px] max-[720px]:py-[5px] max-[720px]:tracking-[.14em] max-[720px]:indent-[.14em] max-[720px]:[&_svg]:h-[9px] max-[720px]:[&_svg]:w-[17px]",
  "max-[480px]:hidden",
].join(" ");

export const DEVICE_SWITCHER =
  "mt-[3px] inline-flex items-center gap-[2px] rounded-full border border-[rgba(122,222,255,.35)] bg-[rgba(11,36,58,.5)] p-[3px] backdrop-blur-[6px] max-[720px]:mt-[1px] max-[720px]:p-[2px] max-[480px]:hidden";

/** `/watch`: the chip floats over the backdrop, under the detail overlay (z 35) and chat panel (z 40). */
export const DEVICE_SWITCHER_FLOAT =
  "absolute right-[14px] top-[calc(env(safe-area-inset-top,0px)_+_10px)] z-[20] mt-0!";

export const DEVICE_OPTION = [
  "inline-flex items-center gap-[7px] rounded-full! border-0 bg-transparent px-[13px] py-[7px] no-underline",
  "text-[10px] font-medium tracking-[.2em] indent-[.2em] uppercase whitespace-nowrap text-[#8fb8d4]!",
  "[transition:background_.18s,color_.18s,box-shadow_.18s]",
  "hover:text-[#d4f4ff]!",
  "aria-pressed:bg-[rgba(120,234,255,.16)] aria-pressed:text-[#d9f6ff]! aria-pressed:shadow-[inset_0_0_0_1px_rgba(140,231,255,.45),0_0_14px_rgba(105,214,255,.18)]",
  "[&_svg]:block [&_svg]:size-[14px]",
  "focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[#f5fcff]!",
  "max-[1000px]:gap-[6px] max-[1000px]:px-[9px] max-[1000px]:py-[6px] max-[1000px]:text-[9px] max-[1000px]:tracking-[.14em] max-[1000px]:indent-[.14em] max-[1000px]:[&_svg]:size-[12px]",
  "max-[720px]:px-[8px] max-[720px]:py-[5px] max-[720px]:[&_svg]:size-[11px]",
].join(" ");

// ---- Watch device frame (`/watch`) -----------------------------------------------------------------

export const WATCH_STAGE = [
  "absolute inset-0 z-[5] flex flex-col items-center justify-center gap-[10px]",
  "pt-[calc(env(safe-area-inset-top,0px)_+_8px)] pr-[16px] pb-[calc(env(safe-area-inset-bottom,0px)_+_10px)] pl-[16px]",
].join(" ");

export const WATCH_DEVICE =
  "relative mx-auto aspect-[1191/1320] h-auto w-[min(94vw,calc((100dvh_-_96px)*1191/1320))] flex-none";

export const WATCH_SCREEN = [
  // `watch-screen` is kept as the hook the `[.watch-screen_&]` variants select on (the old
  // `.watch-screen …` descendant selectors); it carries no declarations of its own.
  "watch-screen absolute left-[22.6%] top-[20.2%] z-[1] h-[53.4%] w-[53.3%] overflow-hidden",
  "[border-radius:22%/20%] [container-type:size] [transform:translateZ(0)]",
  "bg-[radial-gradient(130%_130%_at_50%_-10%,#0c2740_0%,#061321_58%,#040e1a_100%)]",
  "shadow-[inset_0_0_64px_rgba(0,0,0,.6)]",
].join(" ");

export const WATCH_FRAME = "pointer-events-none absolute inset-0 z-[2] h-full w-full [object-fit:fill]";

export const WATCH_CAPTION =
  "m-0 whitespace-nowrap! text-center text-[10px] tracking-[.3em] indent-[.3em] uppercase text-[#7d99ad] max-[480px]:text-[9px] max-[480px]:tracking-[.24em] max-[480px]:indent-[.24em]";

// ---- Detail dialog (shared by the staged screen, the declarative screen and the watch face) ---------

export const DETAIL_OVERLAY = [
  "absolute inset-0 z-[35] flex items-center justify-center bg-[rgba(2,12,28,.4)] backdrop-blur-[7px]",
  "[.watch-screen_&]:bg-[rgba(3,10,22,.52)] [.watch-screen_&]:p-[4%] [.watch-screen_&]:backdrop-blur-[4px]",
  "max-[480px]:p-[6px]",
].join(" ");

export const DETAIL_GLASS = [
  "relative min-h-[290px] w-[min(490px,calc(100vw_-_36px))] p-[34px_40px]",
  "[border-radius:49%_48%_46%_51%/20%_26%_18%_23%]!",
  "border border-[rgba(115,219,255,.34)]",
  "bg-[radial-gradient(ellipse_at_28%_12%,rgba(38,129,184,.24),rgba(9,36,68,.91)_85%)]",
  "shadow-[0_0_70px_rgba(33,118,202,.22),inset_0_0_45px_rgba(76,186,242,.07)]",
  "[&_h2]:[margin:18px_0_5px]! [&_h2]:text-[30px] [&_h2]:font-light",
  "[.watch-screen_&]:min-h-0 [.watch-screen_&]:max-h-full [.watch-screen_&]:w-full [.watch-screen_&]:overflow-y-auto [.watch-screen_&]:[border-radius:6cqw]! [.watch-screen_&]:[border-width:1px] [.watch-screen_&]:[padding:4.5cqw_5.5cqw] [.watch-screen_&]:[&_h2]:[margin:2cqw_0_1cqw]! [.watch-screen_&]:[&_h2]:text-[4.4cqw]",
  "max-[480px]:min-h-0 max-[480px]:max-h-[calc(100dvh_-_12px)] max-[480px]:w-[calc(100vw_-_12px)] max-[480px]:overflow-y-auto max-[480px]:rounded-[20px]! max-[480px]:[padding:20px_18px] max-[480px]:[&_h2]:[margin:10px_0_4px]! max-[480px]:[&_h2]:text-[23px]",
].join(" ");

export const DETAIL_CLOSE = [
  "absolute right-[24px] top-[20px] cursor-pointer border-0 bg-transparent text-[32px]! text-[#eaffff]",
  "[.watch-screen_&]:right-[3cqw] [.watch-screen_&]:top-[2.2cqw] [.watch-screen_&]:p-[1cqw] [.watch-screen_&]:text-[5cqw]! [.watch-screen_&]:leading-none!",
  "max-[480px]:right-[12px] max-[480px]:top-[8px] max-[480px]:text-[28px]!",
  FOCUS_RING,
].join(" ");

export const DETAIL_EYEBROW = "text-[10px] tracking-[.2em] text-[#88e1f6] [.watch-screen_&]:text-[1.5cqw]";

export const DETAIL_VALUE =
  "mb-[16px]! text-[37px] font-light text-[#74edff] [.watch-screen_&]:mb-[2cqw]! [.watch-screen_&]:text-[5.6cqw] max-[480px]:mb-[10px]! max-[480px]:text-[28px]";

export const DETAIL_MESSAGE = [
  "text-[15px] leading-[1.55] text-[#c0d1e2]",
  "[.watch-screen_&]:text-[2.15cqw] [.watch-screen_&]:leading-[1.5]",
  "max-[480px]:text-[14px]",
].join(" ");

export const DETAIL_FOOTER =
  "mt-[24px]! text-[11px] text-[#8ba9be] [.watch-screen_&]:mt-[2.4cqw]! [.watch-screen_&]:text-[1.6cqw]";

export const DETAIL_ACTION = [
  "mt-[18px] cursor-pointer rounded-[4px]! border px-[18px] py-[10px]",
  "border-[rgba(115,219,255,.45)] bg-[rgba(22,86,132,.35)] text-[14px]! font-medium! text-[#d8f6ff]",
  "[transition:border-color_.18s,background_.18s]",
  "hover:border-[#8ce7ff] hover:bg-[rgba(30,116,170,.45)]",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#edf4f1]!",
  "[.watch-screen_&]:mt-[2cqw] [.watch-screen_&]:px-[3cqw] [.watch-screen_&]:py-[1.6cqw] [.watch-screen_&]:text-[2.1cqw]!",
].join(" ");
