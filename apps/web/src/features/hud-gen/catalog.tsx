// The HUD catalog: the declarative vocabulary SkyScreenGen's display tree is written in.
//
// Rules that hold everywhere in this file, same as the rest of Sky:
//   - components are thin and read ALL data from HudScopeContext (facts, copy, phase, nodes);
//     no string or digit reaches a program;
//   - values reach the screen only through Fact/MetricTile, resolved from the HUD facts builder;
//   - buttons fire host-provided actions by calling `useHudScope().onAction` directly (see
//     HUD_ACTION_NAMES); the host validates the payload and maps each action to a behavior; actions
//     carry no state, the crew confirms every action. The action types stay registered with
//     `defineAction` because the LLM program schema needs them, but they are NOT fired through
//     OpenUI's `useTriggerAction`: `@openuidev/react-lang` 1.1.0 swallows any action type present in
//     `schema.actions` (it returns before calling the renderer's `onAction`), so routing through the
//     scope is the only path that reaches the host.
//
// `Section` is the only layout component: the HUD is absolutely positioned by the shared Tailwind
// class strings in `features/sky-hud/hud-classes.ts`, and the section wrappers are what anchors it.
// It partitions its children for the conversation area (orb and waveform slots) and renders each
// region with exactly the utilities the staged SkyScreen uses, so both screens stay identical.
import { createLibrary, createParser, defineAction, defineComponent } from "@openuidev/react-lang";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import type { ReactNode } from "react";
import { z } from "zod/v4";
import BlurText from "~/shared/react-bits/BlurText/BlurText";
import CountUp from "~/shared/react-bits/CountUp/CountUp";
import DecryptedText from "~/shared/react-bits/DecryptedText/DecryptedText";
import DepthText from "~/shared/react-bits/DepthText/DepthText";
import GradientText from "~/shared/react-bits/GradientText/GradientText";
import ShinyText from "~/shared/react-bits/ShinyText/ShinyText";
import VariableProximity from "~/shared/react-bits/VariableProximity/VariableProximity";
// The vendored react-bits sources are @ts-nocheck; their inferred prop types demand props the
// runtime never requires (e.g. dpr/style/fromColor/onAnimationComplete fall back to defaults).
// Alias them to any at the boundary so the rest of this file stays type-checked.
/* eslint-disable @typescript-eslint/no-explicit-any */
const BlurTextAny = BlurText as any;
const CountUpAny = CountUp as any;
const DecryptedTextAny = DecryptedText as any;
const DepthTextAny = DepthText as any;
const GradientTextAny = GradientText as any;
const ShinyTextAny = ShinyText as any;
const VariableProximityAny = VariableProximity as any;
import { hasDigit, type ParseProgram } from "./model/review";
import { HUD_FACT_IDS, HUD_VITAL_KINDS } from "./model/names";
import { FIXTURE_LABEL } from "~/features/sky-hud/vitals";
import { InputSurface } from "~/features/sky-hud/InputSurface";
import { DeviceSwitcher } from "~/features/sky-hud/components/DeviceSwitcher";
import { useHudScope } from "./scope";
import {
  BRAND, BRAND_COPY, BRAND_NAME, BRAND_RING, BRAND_TAGLINE, CAPTIONS, CHEST_GLOW, CONVERSATION,
  CONVERSATION_COPY, CONVERSATION_LENS, CONVERSATION_LENS_LISTENING, DEMO_INDICATOR, DETAIL_ACTION,
  HEALTH_DEMO, HEALTH_GUIDANCE, HEALTH_LABEL, HEALTH_PROJECTION, HEALTH_SHIELD, HEALTH_STATUS,
  HEALTH_SUMMARY, HOLOGRAM_LINK, HUMAN_HOLOGRAM, LENS_INNER, MISSION_TEXT, MISSION_TRIGGER,
  MISSION_UNDERLINE, ORB_FALLBACK, ORB_ZONE, ORB_ZONE_THINKING, SKY_HEADER, SKY_HEADER_ACTIONS,
  SPACECRAFT_LINK, STATION_ICON, TEXT_TRIGGER, VITAL_ICON, VITAL_ICON_OXYGEN, VITAL_TILE, VITAL_VALUE,
  VITALS_PROJECTION, VITALS_SHIELD, VOICE_CONTROL, VOICE_HINT, micButtonClass,
} from "~/features/sky-hud/hud-classes";

// ---- hud-gen-only classes (were catalog.module.css) --------------------------------------------

/** Groups the four tiles without affecting layout (display: contents). */
const METRIC_ROW = "contents";

/** Mirrors the staged tiles' lilac sleep accent so an agent may reorder the tiles. */
const VITAL_VIOLET =
  "[&_.vital-icon]:text-[#f0d1ff] [&_.vital-icon]:after:border-[#c19dfd] [&_.vital-icon]:after:drop-shadow-[0_0_5px_#af8dff]";

/** Generic Fact(id) row for moments the HUD shows a bare sourced value inline. */
const HUD_GEN_FACT =
  "inline-flex items-baseline gap-[6px] text-[14px] font-light text-[#edf8ff] [&_small]:text-[11px] [&_small]:text-[#a8bbce]";

/** Footer disclaimer, always visible. */
const HUD_GEN_FOOTER_NOTE = [
  "pointer-events-none absolute bottom-[10px] left-1/2 z-[11] m-0 [transform:translateX(-50%)]",
  "whitespace-nowrap! text-[10px] tracking-[.04em] text-[rgba(168,187,206,.62)]",
  "max-[720px]:bottom-[6px] max-[720px]:text-[9px]",
].join(" ");

/** One-line hint shown only when the agent composed the active layout. */
const HUD_GEN_COMPOSE_HINT = [
  "absolute bottom-[28px] left-1/2 z-[11] inline-flex max-w-[90vw] cursor-pointer items-center gap-[8px]",
  "[transform:translateX(-50%)] rounded-full! border border-[rgba(115,219,255,.28)] bg-[rgba(8,34,66,.72)]",
  "px-[14px] py-[3px] text-[10px]! tracking-[.06em] whitespace-nowrap text-[rgba(200,230,245,.88)]",
  "hover:border-[rgba(139,233,255,.55)] hover:text-[#eaffff]",
  "focus-visible:outline-2! focus-visible:outline-offset-[5px]! focus-visible:outline-[#f5fcff]!",
  "max-[720px]:hidden",
].join(" ");

/** Plain callout — deliberately not the vendored Arc Alert (Arc stays unused in the HUD by contract). */
const HUD_GEN_ALERT = [
  "my-[8px] flex max-w-[320px] flex-col gap-[3px] rounded-[14px] border",
  "border-[rgba(115,219,255,.3)] bg-[rgba(9,36,68,.55)] px-[14px] py-[10px]",
  "text-[12px] font-light leading-[1.45] text-[#c9e6f5]",
  "[&_strong]:text-[13px] [&_strong]:font-medium [&_strong]:text-[#eaffff]",
].join(" ");

const HUD_GEN_ALERT_TONE: Record<(typeof ALERT_TONES)[number], string> = {
  info: "border-l-2 border-l-[#78eaff]",
  caution: "border-l-2 border-l-[#ffd479]",
  success: "border-l-2 border-l-[#60efc0]",
  danger: "border-l-2 border-l-[#f8b89d]",
};

// Program-facing guard. The review also rejects digits in free text; this keeps streamed drafts safe.
const safeText = (text: string | undefined) => (text && !hasDigit(text) ? text : null);

const ALERT_TONES = ["info", "caution", "success", "danger"] as const;

const SECTION_AREAS = ["header", "vitals", "conversation", "health", "voice", "input"] as const;
type SectionArea = (typeof SECTION_AREAS)[number];

const VITAL_ICON_SVGS: Record<(typeof HUD_VITAL_KINDS)[number], ReactNode> = {
  heartRate: (
    <svg viewBox="0 0 56 56" fill="none"><path d="M28 43 15.5 30.7C5.5 20.6 20.3 9.2 28 21c7.7-11.8 22.5-.4 12.5 9.7L28 43Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg>
  ),
  respiration: (
    <svg viewBox="0 0 56 56" fill="none"><path d="M27.5 13v21m1-18 5-4m-5 12 5-6m-7 1-4-6M24 28c-2-5-3-7-5-6-6 1-11 14-8 21 2 5 10 4 14-1l1-11m5-3c2-5 3-7 5-6 6 1 11 14 8 21-2 5-10 4-14-1l-1-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  spo2: (
    <>
      O<sub>2</sub>
    </>
  ),
  sleep: (
    <svg viewBox="0 0 56 56" fill="none"><path d="M39.8 39.2C29.2 45.6 15.5 39 13.6 26.5c-1-7.1 2.4-13.6 8.4-17.4-1.4 13.2 6.4 22.5 19.1 19-1.1 4.8-5 8.5-1.3 11.1Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /></svg>
  ),
};

// ---- Actions -------------------------------------------------------------------------------------

export const openVital = defineAction({
  name: "OpenVital",
  description: "Open the detail dialog for one vital. Payload kind is one of the HUD vitals.",
  params: z.object({ kind: z.enum(HUD_VITAL_KINDS) }),
});

export const openWellness = defineAction({
  name: "OpenWellness",
  description: "Open the overall wellness detail dialog.",
  params: z.object({}),
});

export const openMission = defineAction({
  name: "OpenMission",
  description: "Open the mission context detail dialog.",
  params: z.object({}),
});

export const openHologram = defineAction({
  name: "OpenHologram",
  description: "Navigate to the body hologram page.",
  params: z.object({}),
});

export const changeAstronaut = defineAction({
  name: "ChangeAstronaut",
  description: "Open the crew picker to claim or switch the followed astronaut.",
  params: z.object({}),
});

export const toggleChat = defineAction({
  name: "ToggleChat",
  description: "Toggle the typed-message panel.",
  params: z.object({}),
});

export const toggleMic = defineAction({
  name: "ToggleMic",
  description: "Toggle the local microphone session.",
  params: z.object({}),
});

export const dismissComposeHint = defineAction({
  name: "DismissComposeHint",
  description: "Dismiss the hint that the layout was composed by the agent.",
  params: z.object({}),
});

// ---- Leaf components ------------------------------------------------------------------------------

const BrandBlock = defineComponent({
  name: "BrandBlock",
  description: "The SKY wordmark and tagline. Activating returns to the overview.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <button className={BRAND} type="button" aria-label={ctx.copy.hud.brandAria} onClick={ctx.resetView}>
        <span className={BRAND_RING} aria-hidden="true" />
        <span className={BRAND_COPY}>
          <span className={BRAND_NAME}><DepthTextAny text="S K Y" fontSize="clamp(20px, 2.2vw, 29px)" fontWeight={300} layers={10} depth={0.5} tilt={4} autoOrbit={false} intro={false} shadow={false} depthColor="#6fa8d6" /></span>
          <span className={BRAND_TAGLINE}><ShinyTextAny color="#9bb0c8" shineColor="#d6f2ff" speed={12} intensity={0.4}>{ctx.copy.hud.tagline}</ShinyTextAny></span>
        </span>
      </button>
    );
  },
});

const MissionButton = defineComponent({
  name: "MissionButton",
  description: "Mission trigger: the demo mission label. Opens the mission dialog.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <button className={MISSION_TRIGGER} type="button" aria-label={ctx.copy.hud.missionAria} onClick={() => ctx.onAction?.({ type: "OpenMission", params: {} })}>
        <span className={STATION_ICON} aria-hidden="true">
          <svg viewBox="0 0 44 36" fill="none">
            <path d="m18 16 8-2M18 21l8-2M15 8l5 10-5 10M28 6l-5 11 5 11M3 12l11-5 4 6-12 5zM31 14l10-5-3 12-9 4z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 8 5 23m31-13-7 17M4 6l7 25m28-24-7 25" stroke="currentColor" strokeWidth="1" />
          </svg>
        </span>
        <span className={MISSION_TEXT}>{ctx.missionLabel}</span>
        <span className={MISSION_UNDERLINE} aria-hidden="true" />
      </button>
    );
  },
});

const HologramButton = defineComponent({
  name: "HologramButton",
  description: "The body-hologram entry: navigates to the anatomy page.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <Link id="hologramButton" to="/body" className={HOLOGRAM_LINK} aria-label={ctx.copy.hud.hologramAria}>
        <svg className={HUMAN_HOLOGRAM} viewBox="0 0 130 236" role="img" aria-label="Glowing holographic human silhouette">
          <defs>
            <linearGradient id="bodyFill" x1="0" x2="1"><stop stopColor="#80e9ff" stopOpacity=".16" /><stop offset=".48" stopColor="#e5ffff" stopOpacity=".24" /><stop offset="1" stopColor="#65c9ff" stopOpacity=".12" /></linearGradient>
            <linearGradient id="bodyStroke" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#d5faff" /><stop offset=".5" stopColor="#67d9ff" /><stop offset="1" stopColor="#71b8ff" /></linearGradient>
            <radialGradient id="chestPulse"><stop stopColor="#ffe0a0" stopOpacity=".9" /><stop offset=".3" stopColor="#ffc27f" stopOpacity=".4" /><stop offset="1" stopColor="#ffbe8f" stopOpacity="0" /></radialGradient>
            <filter id="bodyGlow"><feGaussianBlur stdDeviation="3" /></filter>
          </defs>
          <g>
            <path id="humanShape" d="M66 17c-9 0-13 8-11 18 1 7 3 10 6 12v10c-9 3-20 5-26 13-4 6-7 23-11 43l-7 29c-3 11-1 17 3 18 4 1 6-5 7-13l10-29 5-26-1 39c0 14 1 25 4 37l4 44 2 30c1 6 5 8 9 6l5-43 5-46 6 46 3 43c5 3 9 0 9-7l4-33 3-40 2-39-1-39 6 25 9 29c2 10 5 16 9 13 4-2 3-10 0-19l-8-31c-5-22-6-34-11-39-7-8-17-10-26-13V47c4-4 6-10 6-16 0-10-5-14-15-14Z" fill="url(#bodyFill)" stroke="url(#bodyStroke)" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M65 57 65 103m-25-11c6 6 16 10 25 9 11 1 21-3 27-9M50 154c8 2 23 2 32 0m-16-51v52" stroke="#a8f7ff" opacity=".4" fill="none" />
            <ellipse cx="66" cy="96" rx="29" ry="38" fill="url(#chestPulse)" className={CHEST_GLOW} />
          </g>
          <use href="#humanShape" fill="none" stroke="#a0eeff" strokeWidth="3.5" opacity=".65" filter="url(#bodyGlow)" />
        </svg>
      </Link>
    );
  },
});

const Greeting = defineComponent({
  name: "Greeting",
  description: "The greeting headline for the followed crew member.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <h1 id="greeting">
        {ctx.fx ? <BlurTextAny text={ctx.greeting} animationFrom={{ filter: "blur(10px)", opacity: 0 }} animationTo={[{ filter: "blur(0px)", opacity: 1 }]} color="#ecf7ff" easing="easeOut" /> : ctx.greeting}
      </h1>
    );
  },
});

const AskPrompt = defineComponent({
  name: "AskPrompt",
  description: "The open question under the greeting.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <p id="prompt">
        <VariableProximityAny label={ctx.prompt} containerRef={ctx.conversationCopyRef} radius={60} />
      </p>
    );
  },
});

const MetricTile = defineComponent({
  name: "MetricTile",
  description: "One vitals tile: the demo icon and the fact's value. tone=\"violet\" tints the sleep tile.",
  props: z.object({
    fact: z.enum(HUD_VITAL_KINDS).describe("Which fact the tile shows"),
    tone: z.enum(["violet"]).optional().describe("Optional violet accent (sleep)"),
  }),
  component: ({ props }) => {
    const ctx = useHudScope();
    const fact = ctx.facts[props.fact];
    return (
      <button
        type="button"
        className={props.tone === "violet" ? `${VITAL_TILE} ${VITAL_VIOLET}` : VITAL_TILE}
        aria-label={fact.aria}
        onClick={() => ctx.onAction?.({ type: "OpenVital", params: { kind: props.fact } })}
      >
        <span className={props.fact === "spo2" ? `${VITAL_ICON} ${VITAL_ICON_OXYGEN}` : VITAL_ICON} aria-hidden="true">
          {VITAL_ICON_SVGS[props.fact]}
        </span>
        <span className={VITAL_VALUE}>
          {fact.segments.map((segment, index) => (
            <Fragment key={index}>
              {index > 0 ? " " : null}
              {ctx.fx ? <CountUpAny to={Number(segment.value)} trigger="load" duration={1.2} decimals={0} /> : segment.value}{" "}
              {segment.unit ? <small>{segment.unit}</small> : null}
            </Fragment>
          ))}
        </span>
      </button>
    );
  },
});

const Fact = defineComponent({
  name: "Fact",
  description: "A bare sourced value resolved from the HUD facts builder. The only way a number reaches the HUD besides MetricTile.",
  props: z.object({ id: z.enum(HUD_FACT_IDS).describe("Fact id") }),
  component: ({ props }) => {
    const ctx = useHudScope();
    const fact = ctx.facts[props.id];
    if (!fact) return null;
    return (
      <span className={HUD_GEN_FACT} aria-label={fact.aria}>
        {fact.segments.map((segment, index) => (
          <Fragment key={index}>
            {index > 0 ? " " : null}
            {segment.value}
            {segment.unit ? <small>{segment.unit}</small> : null}
          </Fragment>
        ))}
      </span>
    );
  },
});

const WellnessCard = defineComponent({
  name: "WellnessCard",
  description: "Overall wellness: demo status, value and guidance. Opens the wellness detail.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    const h = ctx.copy.hud;
    return (
      <button type="button" id="healthButton" className={HEALTH_SUMMARY} aria-label={h.wellnessAria} onClick={() => ctx.onAction?.({ type: "OpenWellness", params: {} })}>
        <span className={HEALTH_LABEL}>{h.wellnessLabel}</span>
        <strong className={HEALTH_STATUS}><GradientTextAny colors={["#7fe9c9", "#5ee6ff", "#7fe9c9"]} animationSpeed={3} pointerEvents="none">{h.wellnessStatus}</GradientTextAny></strong>
        <span className={HEALTH_GUIDANCE}>{h.wellnessGuidance}</span>
        <span className={HEALTH_DEMO}>{ctx.fx ? <DecryptedTextAny text={h.wellnessDemo} animateOn="view" loop={false} speed={50} /> : h.wellnessDemo}</span>
      </button>
    );
  },
});

const Alert = defineComponent({
  name: "Alert",
  description: "A callout. Use caution for safety reminders.",
  props: z.object({
    tone: z.enum(ALERT_TONES).describe("info, caution, success or danger"),
    title: z.string().describe("The headline of the callout"),
    body: z.string().optional().describe("One optional extra line"),
  }),
  component: ({ props }) => {
    const title = safeText(props.title);
    if (!title) return null;
    const body = safeText(props.body);
    return (
      <div className={`${HUD_GEN_ALERT} ${HUD_GEN_ALERT_TONE[props.tone]}`} role="note">
        <strong>{title}</strong>
        {body ? <span>{body}</span> : null}
      </div>
    );
  },
});

const FixtureBadge = defineComponent({
  name: "FixtureBadge",
  description: "The simulated-data flag shown under the vitals.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <span className={DEMO_INDICATOR}>
        {ctx.fx ? <DecryptedTextAny text={FIXTURE_LABEL} animateOn="view" loop={false} speed={50} /> : FIXTURE_LABEL}
      </span>
    );
  },
});

const OrbCanvas = defineComponent({
  name: "OrbCanvas",
  description: "The voice orb slot. Renders the host-provided orb node in declarative order.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <div className={`${ORB_ZONE}${ctx.phase === "thinking" ? ` ${ORB_ZONE_THINKING}` : ""}`} aria-hidden="true">
        <div className={ORB_FALLBACK} />
        {ctx.orbNode}
      </div>
    );
  },
});

const WaveCanvas = defineComponent({
  name: "WaveCanvas",
  description: "The voice waveform slot. Renders the host-provided waveform node in declarative order.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return <>{ctx.waveNode}</>;
  },
});

const MicButton = defineComponent({
  name: "MicButton",
  description: "The microphone toggle with its live hint. Local audio analysis only.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <>
        <button id="micButton" className={micButtonClass(ctx.phase, "console")} type="button" aria-label={ctx.micAria} disabled={ctx.phase === "requesting_permission"} onClick={() => ctx.onAction?.({ type: "ToggleMic", params: {} })}>
          <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="8" width="12" height="24" rx="6" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M13 24c0 15 22 15 22 0M24 36v6m-7 0h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        </button>
        <div id="voiceHint" className={VOICE_HINT} aria-live="polite">{ctx.hint}</div>
      </>
    );
  },
});

const ChatButton = defineComponent({
  name: "ChatButton",
  description: "The typed-message trigger (chat alternative to voice).",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <button type="button" className={TEXT_TRIGGER} id="textButton" aria-label={ctx.copy.hud.typeInsteadAria} aria-pressed={ctx.chatOpen} onClick={() => ctx.onAction?.({ type: "ToggleChat", params: {} })}>
        {ctx.copy.watch.typeInstead}
      </button>
    );
  },
});

const ChangeAstronautButton = defineComponent({
  name: "ChangeAstronautButton",
  description: "Opens the crew picker to claim or switch the followed astronaut.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <button type="button" id="changeAstronautButton" className={DETAIL_ACTION} onClick={() => ctx.onAction?.({ type: "ChangeAstronaut", params: {} })}>
        {ctx.copy.astronaut.change}
      </button>
    );
  },
});

const FooterNote = defineComponent({
  name: "FooterNote",
  description: "Footer small print: the demo disclaimer, plus a dismissable hint while the agent-composed layout is active.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <>
        {ctx.composeOrigin === "agent" && !ctx.composeHintDismissed ? (
          <button type="button" className={HUD_GEN_COMPOSE_HINT} aria-label={ctx.copy.hud.composeHintDismissAria} onClick={() => ctx.onAction?.({ type: "DismissComposeHint", params: {} })}>
            <span>{ctx.composeHint}</span>
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
        <p className={HUD_GEN_FOOTER_NOTE}>{ctx.copy.chat.footer}</p>
      </>
    );
  },
});

const MetricRow = defineComponent({
  name: "MetricRow",
  description: "Groups the vitals tiles. Layout-neutral.",
  props: z.object({
    children: z
      .array(z.union([MetricTile.ref]))
      .describe("The vitals tiles, in display order"),
  }),
  component: ({ props, renderNode }) => <div className={METRIC_ROW} role="group">{renderNode(props.children)}</div>,
});

// ---- Layout chrome --------------------------------------------------------------------------------

interface ChildNode {
  readonly type?: string;
  readonly typeName?: string;
}

function childTypeName(child: unknown): string | null {
  return child && typeof child === "object" && typeof (child as ChildNode).typeName === "string" ? ((child as ChildNode).typeName as string) : null;
}

function toChildArray(children: unknown): ChildNode[] {
  if (Array.isArray(children)) return children as ChildNode[];
  if (children) return [children as ChildNode];
  return [];
}

const LEAF_REFS = [
  BrandBlock.ref,
  MissionButton.ref,
  HologramButton.ref,
  Greeting.ref,
  AskPrompt.ref,
  MetricTile.ref,
  Fact.ref,
  WellnessCard.ref,
  Alert.ref,
  FixtureBadge.ref,
  OrbCanvas.ref,
  WaveCanvas.ref,
  MicButton.ref,
  ChatButton.ref,
  ChangeAstronautButton.ref,
  MetricRow.ref,
] as const;

const Section = defineComponent({
  name: "Section",
  description: "One region of the HUD. Areas: header, vitals, conversation, health, voice, input.",
  props: z.object({
    area: z.enum(SECTION_AREAS).describe("Which HUD region this is"),
    children: z.array(z.union(LEAF_REFS)).optional().describe("Parts inside the region"),
  }),
  component: ({ props, renderNode }) => {
    const ctx = useHudScope();
    const children = toChildArray(props.children);
    switch (props.area as SectionArea) {
      case "header": {
        // Staged layout: brand left, chrome actions right (mission + device switcher + spacecraft).
        const brand = toChildArray(props.children).filter((child) => childTypeName(child) === "BrandBlock");
        const rest = toChildArray(props.children).filter((child) => childTypeName(child) !== "BrandBlock");
        return (
          <header className={SKY_HEADER}>
            {renderNode(brand)}
            <div className={SKY_HEADER_ACTIONS}>
              {renderNode(rest)}
              <DeviceSwitcher current="console" />
              <Link id="spacecraftLink" to="/spacecraft" className={SPACECRAFT_LINK} aria-label={ctx.copy.hud.spacecraftButtonAria}>
                <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="1.3" y="8" width="13" height="8" rx="1.2" />
                  <path d="M5.6 8v8M9.9 8v8" />
                  <rect x="33.7" y="8" width="13" height="8" rx="1.2" />
                  <path d="M38.1 8v8M42.4 8v8" />
                  <rect x="19" y="6" width="10" height="12" rx="1.6" />
                  <path d="M24 6V2.6M21.6 2.6h4.8" />
                  <circle cx="24" cy="12" r="1.5" />
                </svg>
                <span>{ctx.copy.hud.spacecraftButton}</span>
              </Link>
            </div>
          </header>
        );
      }
      case "vitals":
        return (
          <section className={VITALS_PROJECTION} aria-label={ctx.copy.hud.vitalsAria}>
            <div className={VITALS_SHIELD} aria-hidden="true" />
            {renderNode(children)}
          </section>
        );
      case "health":
        return (
          <section className={HEALTH_PROJECTION} aria-label={ctx.copy.hud.healthAria}>
            <div className={HEALTH_SHIELD} aria-hidden="true" />
            {renderNode(children)}
          </section>
        );
      case "input":
        return <InputSurface />;
      case "voice":
        return <div className={VOICE_CONTROL}>{renderNode(children)}</div>;
      case "conversation": {
        const isSlot = (child: ChildNode, name: string) => childTypeName(child) === name;
        const orb = children.filter((child) => isSlot(child, "OrbCanvas"));
        const wave = children.filter((child) => isSlot(child, "WaveCanvas"));
        const copySlot = children.filter((child) => !isSlot(child, "OrbCanvas") && !isSlot(child, "WaveCanvas"));
        return (
          <section className={CONVERSATION} aria-label={ctx.copy.hud.conversationAria}>
            <div className={`${CONVERSATION_LENS}${ctx.phase === "listening" ? ` ${CONVERSATION_LENS_LISTENING}` : ""}`} aria-hidden="true"><div className={LENS_INNER} /></div>
            {renderNode(orb)}
            <div className={CONVERSATION_COPY} ref={ctx.conversationCopyRef}>
              {renderNode(copySlot)}
            </div>
            {renderNode(wave)}
            <p id="captions" className={CAPTIONS} aria-live="polite">{ctx.captions}</p>
          </section>
        );
      }
      default:
        return null;
    }
  },
});

// ---- Root -----------------------------------------------------------------------------------------

const Surface = defineComponent({
  name: "Surface",
  description: "The root of the HUD display tree. One Surface per screen, holding Section regions.",
  props: z.object({
    children: z.array(z.union([Section.ref, FooterNote.ref])).describe("The regions of the HUD"),
  }),
  component: ({ props, renderNode }) => <>{renderNode(props.children)}</>,
});

export const hudLibrary = createLibrary({
  components: [
    Surface,
    Section,
    BrandBlock,
    MissionButton,
    HologramButton,
    Greeting,
    AskPrompt,
    MetricRow,
    MetricTile,
    Fact,
    WellnessCard,
    Alert,
    FixtureBadge,
    OrbCanvas,
    WaveCanvas,
    MicButton,
    ChatButton,
    ChangeAstronautButton,
    FooterNote,
  ],
  root: "Surface",
  actions: [openVital, openWellness, openMission, openHologram, changeAstronaut, toggleChat, toggleMic, dismissComposeHint],
});

const parser = createParser(hudLibrary.toJSONSchema(), hudLibrary.root);

/** Parses a program against this catalog, for `reviewProgram`. */
export const parseHudProgram: ParseProgram = (source) => parser.parse(source);
