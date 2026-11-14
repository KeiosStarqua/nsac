// The HUD catalog: the declarative vocabulary SkyScreenGen's display tree is written in.
//
// Rules that hold everywhere in this file, same as the rest of Sky:
//   - components are thin and read ALL data from HudScopeContext (facts, copy, phase, nodes);
//     no string or digit reaches a program;
//   - values reach the screen only through Fact/MetricTile, resolved from the HUD facts builder;
//   - buttons fire host-provided actions through useTriggerAction (see HUD_ACTION_NAMES); the host
//     validates the payload and maps each action to a behavior; actions carry no state, the crew
//     confirms every action.
//
// `Section` is the only layout component: the HUD is absolutely positioned (hud-screen.css), and the
// section wrappers are what anchors it. It partitions its children for the conversation area (orb and
// waveform slots) and renders each region with the class names hud-screen.css already defines.
import { createLibrary, createParser, defineAction, defineComponent, useTriggerAction } from "@openuidev/react-lang";
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
import styles from "./catalog.module.css";

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
      <button className="brand home-trigger" type="button" aria-label={ctx.copy.hud.brandAria} onClick={ctx.resetView}>
        <span className="brand-ring" aria-hidden="true" />
        <span className="brand-copy">
          <span className="brand-name"><DepthTextAny text="S K Y" fontSize="clamp(20px, 2.2vw, 29px)" fontWeight={300} layers={10} depth={0.5} tilt={4} autoOrbit={false} intro={false} shadow={false} depthColor="#6fa8d6" /></span>
          <span className="brand-tagline"><ShinyTextAny color="#9bb0c8" shineColor="#d6f2ff" speed={12} intensity={0.4}>{ctx.copy.hud.tagline}</ShinyTextAny></span>
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
    const trigger = useTriggerAction();
    return (
      <button className="mission-trigger" type="button" aria-label={ctx.copy.hud.missionAria} onClick={() => void trigger("Mission context", undefined, { type: "OpenMission", params: {} })}>
        <span className="station-icon" aria-hidden="true">
          <svg viewBox="0 0 44 36" fill="none">
            <path d="m18 16 8-2M18 21l8-2M15 8l5 10-5 10M28 6l-5 11 5 11M3 12l11-5 4 6-12 5zM31 14l10-5-3 12-9 4z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 8 5 23m31-13-7 17M4 6l7 25m28-24-7 25" stroke="currentColor" strokeWidth="1" />
          </svg>
        </span>
        <span className="mission-text">{ctx.missionLabel}</span>
        <span className="mission-underline" aria-hidden="true" />
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
      <Link id="hologramButton" to="/body" className="hologram-button" aria-label={ctx.copy.hud.hologramAria}>
        <svg className="human-hologram" viewBox="0 0 130 236" role="img" aria-label="Glowing holographic human silhouette">
          <defs>
            <linearGradient id="bodyFill" x1="0" x2="1"><stop stopColor="#80e9ff" stopOpacity=".16" /><stop offset=".48" stopColor="#e5ffff" stopOpacity=".24" /><stop offset="1" stopColor="#65c9ff" stopOpacity=".12" /></linearGradient>
            <linearGradient id="bodyStroke" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#d5faff" /><stop offset=".5" stopColor="#67d9ff" /><stop offset="1" stopColor="#71b8ff" /></linearGradient>
            <radialGradient id="chestPulse"><stop stopColor="#ffe0a0" stopOpacity=".9" /><stop offset=".3" stopColor="#ffc27f" stopOpacity=".4" /><stop offset="1" stopColor="#ffbe8f" stopOpacity="0" /></radialGradient>
            <filter id="bodyGlow"><feGaussianBlur stdDeviation="3" /></filter>
          </defs>
          <g className="human-figure">
            <path id="humanShape" d="M66 17c-9 0-13 8-11 18 1 7 3 10 6 12v10c-9 3-20 5-26 13-4 6-7 23-11 43l-7 29c-3 11-1 17 3 18 4 1 6-5 7-13l10-29 5-26-1 39c0 14 1 25 4 37l4 44 2 30c1 6 5 8 9 6l5-43 5-46 6 46 3 43c5 3 9 0 9-7l4-33 3-40 2-39-1-39 6 25 9 29c2 10 5 16 9 13 4-2 3-10 0-19l-8-31c-5-22-6-34-11-39-7-8-17-10-26-13V47c4-4 6-10 6-16 0-10-5-14-15-14Z" fill="url(#bodyFill)" stroke="url(#bodyStroke)" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M65 57 65 103m-25-11c6 6 16 10 25 9 11 1 21-3 27-9M50 154c8 2 23 2 32 0m-16-51v52" stroke="#a8f7ff" opacity=".4" fill="none" />
            <ellipse cx="66" cy="96" rx="29" ry="38" fill="url(#chestPulse)" className="chest-glow" />
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
    const trigger = useTriggerAction();
    const fact = ctx.facts[props.fact];
    return (
      <button
        type="button"
        className={props.tone === "violet" ? `vital ${styles.vitalViolet}` : "vital"}
        aria-label={fact.aria}
        onClick={() => void trigger("Vital details", undefined, { type: "OpenVital", params: { kind: props.fact } })}
      >
        <span className={props.fact === "spo2" ? "vital-icon oxygen" : "vital-icon"} aria-hidden="true">
          {VITAL_ICON_SVGS[props.fact]}
        </span>
        <span className="vital-value">
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
      <span className={styles.hudGenFact} aria-label={fact.aria}>
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
    const trigger = useTriggerAction();
    const h = ctx.copy.hud;
    return (
      <button type="button" id="healthButton" className="health-summary" aria-label={h.wellnessAria} onClick={() => void trigger("Wellness details", undefined, { type: "OpenWellness", params: {} })}>
        <span className="health-label">{h.wellnessLabel}</span>
        <strong><GradientTextAny colors={["#7fe9c9", "#5ee6ff", "#7fe9c9"]} animationSpeed={3} pointerEvents="none">{h.wellnessStatus}</GradientTextAny></strong>
        <span className="health-guidance">{h.wellnessGuidance}</span>
        <span className="health-demo">{ctx.fx ? <DecryptedTextAny text={h.wellnessDemo} animateOn="view" loop={false} speed={50} /> : h.wellnessDemo}</span>
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
      <div className={`${styles.hudGenAlert} ${styles[`hudGenAlert_${props.tone}`]}`} role="note">
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
      <span className="demo-indicator">
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
      <div className="orb-zone" aria-hidden="true">
        <div className="orb-css-fallback" />
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
    const trigger = useTriggerAction();
    return (
      <>
        <button id="micButton" className="mic-button" type="button" aria-label={ctx.micAria} disabled={ctx.phase === "requesting_permission"} onClick={() => void trigger("Toggle microphone", undefined, { type: "ToggleMic", params: {} })}>
          <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="8" width="12" height="24" rx="6" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M13 24c0 15 22 15 22 0M24 36v6m-7 0h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        </button>
        <div id="voiceHint" className="voice-hint" aria-live="polite">{ctx.hint}</div>
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
    const trigger = useTriggerAction();
    return (
      <button type="button" className="text-trigger" id="textButton" aria-label={ctx.copy.hud.typeInsteadAria} aria-pressed={ctx.chatOpen} onClick={() => void trigger("Type instead", undefined, { type: "ToggleChat", params: {} })}>
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
    const trigger = useTriggerAction();
    return (
      <button type="button" id="changeAstronautButton" className="detail-action" onClick={() => void trigger("Change astronaut", undefined, { type: "ChangeAstronaut", params: {} })}>
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
    const trigger = useTriggerAction();
    return (
      <>
        {ctx.composeOrigin === "agent" && !ctx.composeHintDismissed ? (
          <button type="button" className={styles.hudGenComposeHint} aria-label={ctx.copy.hud.composeHintDismissAria} onClick={() => void trigger("Dismiss", undefined, { type: "DismissComposeHint", params: {} })}>
            <span>{ctx.composeHint}</span>
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
        <p className={styles.hudGenFooterNote}>{ctx.copy.chat.footer}</p>
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
  component: ({ props, renderNode }) => <div className={styles.metricRow} role="group">{renderNode(props.children)}</div>,
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
          <header className="sky-header">
            {renderNode(brand)}
            <div className="sky-header-actions">
              {renderNode(rest)}
              <DeviceSwitcher current="console" />
              <Link id="spacecraftLink" to="/spacecraft" className="spacecraft-link" aria-label={ctx.copy.hud.spacecraftButtonAria}>
                <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="1.3" y="8" width="13" height="8" rx="1.2" />
                  <path d="M5.6 8v8M9.9 8v8" />
                  <rect x="33.7" y="8" width="13" height="8" rx="1.2" />
                  <path d="M38.1 8v8M42.4 8v8" />
                  <rect x="19" y="6" width="10" height="12" rx="1.6" />
                  <path d="M24 6V2.6M21.6 2.6h4.8" />
                  <circle cx="24" cy="12" r="1.5" />
                </svg>
                <span className="spacecraft-text">{ctx.copy.hud.spacecraftButton}</span>
              </Link>
            </div>
          </header>
        );
      }
      case "vitals":
        return (
          <section className="vitals-projection" aria-label={ctx.copy.hud.vitalsAria}>
            <div className="vitals-shield" aria-hidden="true" />
            {renderNode(children)}
          </section>
        );
      case "health":
        return (
          <section className="health-projection" aria-label={ctx.copy.hud.healthAria}>
            <div className="health-shield" aria-hidden="true" />
            {renderNode(children)}
          </section>
        );
      case "input":
        return <InputSurface />;
      case "voice":
        return <div className="voice-control">{renderNode(children)}</div>;
      case "conversation": {
        const isSlot = (child: ChildNode, name: string) => childTypeName(child) === name;
        const orb = children.filter((child) => isSlot(child, "OrbCanvas"));
        const wave = children.filter((child) => isSlot(child, "WaveCanvas"));
        const copySlot = children.filter((child) => !isSlot(child, "OrbCanvas") && !isSlot(child, "WaveCanvas"));
        return (
          <section className="conversation" aria-label={ctx.copy.hud.conversationAria}>
            <div className="conversation-lens" aria-hidden="true"><div className="lens-inner" /></div>
            {renderNode(orb)}
            <div className="conversation-copy" ref={ctx.conversationCopyRef}>
              {renderNode(copySlot)}
            </div>
            {renderNode(wave)}
            <p id="captions" className="captions" aria-live="polite">{ctx.captions}</p>
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
