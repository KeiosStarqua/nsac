// The HUD catalog: the declarative vocabulary SkyScreenGen's display tree is written in.
//
// The catalog is a thin shell over the console's presentational modules — it does NOT re-implement
// the layout. Every region component below renders a module under `features/hud-gen/components/*`
// and every style string comes from `features/hud-gen/mock-classes.ts`, so a composed program and
// the preset share one design.
//
// Rules that hold everywhere in this file, same as the rest of Sky:
//   - components read ALL data from HudScopeContext (copy, fixture, phase, nodes); no string or digit
//     reaches a program. The fixture (`HUD_MOCK`) and `copy.hudMock` are the console's own sources;
//   - `Fact` is the only way a bare value can be shown outside a card, and it resolves through
//     the fixture-backed facts builder, never from program text;
//   - buttons fire host-provided actions by calling `useHudScope().onAction` directly (see
//     HUD_ACTION_NAMES); the host validates the payload and maps each action to a behavior; actions
//     carry no state, the crew confirms every action. The action types stay registered with
//     `defineAction` because the LLM program schema needs them, but they are NOT fired through
//     OpenUI's `useTriggerAction`: `@openuidev/react-lang` 1.1.0 swallows any action type present in
//     `schema.actions` (it returns before calling the renderer's `onAction`), so routing through the
//     scope is the only path that reaches the host.
//
// `Surface` is the root. Regions map 1:1 onto the console layout: Header → grid (LeftColumn |
// CenterColumn | RightColumn) → Footer, and each column hosts the cards the console composes there.
import { createLibrary, createParser, defineAction, defineComponent } from "@openuidev/react-lang";
import { useNavigate } from "@tanstack/react-router";
import { Fragment } from "react";
import { z } from "zod/v4";
import { hasDigit, type ParseProgram } from "./model/review";
import { HUD_FACT_IDS } from "./model/names";
import { useHudScope } from "./scope";
import { HUD_MOCK } from "~/features/hud-gen/data/fixture";
import { buildInsightText } from "~/features/hud-gen/data/insight";
import { roleLabel } from "~/features/hud-gen/data/roles";
import { GreetingStack as MockGreetingStack } from "~/features/hud-gen/components/GreetingStack";
import { InsightBand as MockInsightBand } from "~/features/hud-gen/components/InsightBand";
import { CenterColumn, LeftColumn, RightColumn } from "~/features/hud-gen/components/MockColumns";
import { MockHeader } from "~/features/hud-gen/components/MockHeader";
import { OrbStage as MockOrbStage } from "~/features/hud-gen/components/OrbStage";
import { ProfileCard as MockProfileCard } from "~/features/hud-gen/components/ProfileCard";
import {
  MiniCards as MockMiniCards,
  ReadinessCard as MockReadinessCard,
  ReadinessDetail as MockReadinessDetail,
} from "~/features/hud-gen/components/ReadinessPanel";
import { TrendsCard as MockTrendsCard } from "~/features/hud-gen/components/TrendsCard";
import { VitalsCard as MockVitalsCard } from "~/features/hud-gen/components/VitalsCard";
import { VoiceCluster as MockVoiceCluster } from "~/features/hud-gen/components/VoiceCluster";
import { VoiceWave as MockVoiceWave } from "~/features/hud-gen/components/VoiceWave";
import { MOCK_GRID } from "~/features/hud-gen/mock-classes";
import { HoloCredit, HologramBody } from "~/features/sky-hud/components";

// ---- hud-gen-only classes ------------------------------------------------------------------------

/** Generic Fact(id) row for moments a composed tree shows a bare sourced value inline. */
const HUD_GEN_FACT =
  "inline-flex items-baseline gap-[6px] text-[14px] font-light text-[#edf8ff] [&_small]:text-[11px] [&_small]:text-[#a8bbce]";

/** One-line hint shown only when the agent composed the active layout (gen chrome, not the preset). */
const HUD_GEN_COMPOSE_HINT = [
  "absolute bottom-[28px] left-1/2 z-[11] inline-flex max-w-[90vw] cursor-pointer items-center gap-[8px]",
  "[transform:translateX(-50%)] rounded-full! border border-[rgba(115,219,255,.28)] bg-[rgba(8,34,66,.72)]",
  "px-[14px] py-[3px] text-[10px]! tracking-[.06em] whitespace-nowrap text-[rgba(200,230,245,.88)]",
  "hover:border-[rgba(139,233,255,.55)] hover:text-[#eaffff]",
  "focus-visible:outline-2! focus-visible:outline-offset-[5px]! focus-visible:outline-[#f5fcff]!",
  "max-[720px]:hidden",
].join(" ");

/** Plain callout for composed trees — deliberately not the vendored Arc Alert (Arc stays unused). */
const HUD_GEN_ALERT = [
  "my-[8px] flex max-w-[320px] flex-col gap-[3px] rounded-[14px] border",
  "border-[rgba(115,219,255,.3)] bg-[rgba(9,36,68,.55)] px-[14px] py-[10px]",
  "text-[12px] font-light leading-[1.45] text-[#c9e6f5]",
  "[&_strong]:text-[13px] [&_strong]:font-medium [&_strong]:text-[#eaffff]",
].join(" ");

const ALERT_TONES = ["info", "caution", "success", "danger"] as const;

const HUD_GEN_ALERT_TONE: Record<(typeof ALERT_TONES)[number], string> = {
  info: "border-l-2 border-l-[#78eaff]",
  caution: "border-l-2 border-l-[#ffd479]",
  success: "border-l-2 border-l-[#60efc0]",
  danger: "border-l-2 border-l-[#f8b89d]",
};

// Program-facing guard. The review also rejects digits in free text; this keeps streamed drafts safe.
const safeText = (text: string | undefined) => (text && !hasDigit(text) ? text : null);

// ---- Actions -------------------------------------------------------------------------------------

export const openMission = defineAction({
  name: "OpenMission",
  description: "Open the mission context detail dialog.",
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

// ---- Region components (thin wrappers over the console's own modules) -----------------------------

const Header = defineComponent({
  name: "Header",
  description: "The console header: brand mark, mission chip, Console | Watch, locale and spacecraft chips.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <MockHeader
        copy={ctx.copy}
        onBrand={ctx.resetView}
        onMission={() => ctx.onAction?.({ type: "OpenMission", params: {} })}
      />
    );
  },
});

const ProfileCardRegion = defineComponent({
  name: "ProfileCard",
  description: "Astronaut Profile card: simulated portrait, roster name + role, change-astronaut handler.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <MockProfileCard
        name={ctx.astronaut.name}
        role={roleLabel(ctx.astronaut.role, ctx.copy.hudMock.roles)}
        initials={ctx.astronaut.initial}
        avatarSrc={`/astronauts/${ctx.astronaut.id}.png`}
        copy={ctx.copy.hudMock}
        changeLabel={ctx.copy.astronaut.change}
        onChange={() => ctx.onAction?.({ type: "ChangeAstronaut", params: {} })}
      />
    );
  },
});

const VitalsCardRegion = defineComponent({
  name: "VitalsCard",
  description:
    "Vital Signs card: six rows (heart rate, HRV, blood pressure, respiration, SpO₂, temperature) with inline sparklines; the settled live feed overrides the fixture values and swaps the Now tag for the LIVE/HISTORICAL/OFFLINE chip.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    const live = ctx.live;
    return (
      <MockVitalsCard
        vitalSigns={live?.vitals ?? HUD_MOCK.vitalSigns}
        copy={ctx.copy.hudMock}
        liveMode={live?.mode ?? null}
        liveLabel={live?.label ?? null}
      />
    );
  },
});

const TrendsCardRegion = defineComponent({
  name: "TrendsCard",
  description: "Quick Trends card: heart-rate sparkline, sleep bar, activity strip.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return <MockTrendsCard trends={HUD_MOCK.quickTrends} copy={ctx.copy.hudMock} />;
  },
});

const OrbStageRegion = defineComponent({
  name: "OrbStage",
  description: "The voice orb stage. Renders the host's orb node with the console's stage and glow classes.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    const thinking =
      ctx.phase === "requesting_permission" || ctx.phase === "transcribing" || ctx.phase === "thinking";
    return <MockOrbStage orb={ctx.orbNode} chatOpen={ctx.chatOpen} thinking={thinking} />;
  },
});

const GreetingStackRegion = defineComponent({
  name: "GreetingStack",
  description: "The greeting headline and the open question under it.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return <MockGreetingStack greeting={ctx.greeting} prompt={ctx.prompt} />;
  },
});

const VoiceWaveRegion = defineComponent({
  name: "VoiceWave",
  description: "The voice waveform strip between the greeting and the mic control.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return <MockVoiceWave phase={ctx.phase} energyRef={ctx.energyRef} chatOpen={ctx.chatOpen} />;
  },
});

const VoiceClusterRegion = defineComponent({
  name: "VoiceCluster",
  description: "The mic control (pill / listening bar), the live hint line and the Type-instead pill.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    const live = ctx.phase !== "idle" && ctx.phase !== "error" && ctx.phase !== "offline";
    return (
      <MockVoiceCluster
        phase={ctx.phase}
        hint={ctx.hint}
        micLabel={ctx.copy.watch.speakToSky}
        live={live}
        chatOpen={ctx.chatOpen}
        reducedMotion={!ctx.fx}
        energyRef={ctx.energyRef}
        readSpectrum={ctx.readSpectrum}
        onStart={() => ctx.onAction?.({ type: "ToggleMic", params: {} })}
        onStop={() => ctx.onAction?.({ type: "ToggleMic", params: {} })}
        typeInsteadLabel={ctx.copy.watch.typeInstead}
        typeInsteadAria={ctx.copy.hud.typeInsteadAria}
        onToggleChat={() => ctx.onAction?.({ type: "ToggleChat", params: {} })}
      />
    );
  },
});

const InsightBandRegion = defineComponent({
  name: "InsightBand",
  description: "The deterministic insight sentence under the centre column; opens Human Performance.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    const navigate = useNavigate();
    return (
      <MockInsightBand
        text={buildInsightText(ctx.copy.hudMock.insightText)}
        kicker={ctx.copy.hudMock.insightKicker}
        ariaLabel={ctx.copy.hudMock.insightOpen}
        onOpen={() => void navigate({ to: "/performance" })}
        dismissed={ctx.chatOpen}
      />
    );
  },
});

const ReadinessCardRegion = defineComponent({
  name: "ReadinessCard",
  description: "Overall Readiness: the gradient ring, status and guidance.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return <MockReadinessCard readiness={HUD_MOCK.readiness} copy={ctx.copy.hudMock} />;
  },
});

const ReadinessTabsRegion = defineComponent({
  name: "ReadinessTabs",
  description: "Readiness detail: Body | Recovery | Cognitive | Energy tabs, rows and the body hologram.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    const navigate = useNavigate();
    return (
      <MockReadinessDetail
        fixture={HUD_MOCK}
        copy={ctx.copy.hudMock}
        holo={<HologramBody reducedMotion={!ctx.fx} />}
        holoCredit={<HoloCredit placement="footer" />}
        onOpenBody={() => void navigate({ to: "/body" })}
      />
    );
  },
});

const MiniCardsRegion = defineComponent({
  name: "MiniCards",
  description: "The three mini metric cards: activity, energy burned, energy intake.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return <MockMiniCards cards={HUD_MOCK.cards} copy={ctx.copy.hudMock} />;
  },
});

const Fact = defineComponent({
  name: "Fact",
  description:
    "A bare sourced value resolved from the HUD facts builder. The only way a number reaches a composed HUD besides the cards.",
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

// ---- Layout chrome --------------------------------------------------------------------------------

interface ChildNode {
  readonly type?: string;
  readonly typeName?: string;
}

function childTypeName(child: unknown): string | null {
  return child && typeof child === "object" && typeof (child as ChildNode).typeName === "string"
    ? ((child as ChildNode).typeName as string)
    : null;
}

function toChildArray(children: unknown): ChildNode[] {
  if (Array.isArray(children)) return children as ChildNode[];
  if (children) return [children as ChildNode];
  return [];
}

/** Layout-only wrappers: they render the console's own column divs and inject their children. */
function columnComponent(name: string, description: string, Column: typeof LeftColumn) {
  return defineComponent({
    name,
    description,
    props: z.object({
      children: z
        .array(z.union([ProfileCardRegion.ref, VitalsCardRegion.ref, TrendsCardRegion.ref, OrbStageRegion.ref, GreetingStackRegion.ref, VoiceWaveRegion.ref, VoiceClusterRegion.ref, InsightBandRegion.ref, ReadinessCardRegion.ref, ReadinessTabsRegion.ref, MiniCardsRegion.ref, Fact.ref, Alert.ref]))
        .optional()
        .describe("The cards of this column, in display order"),
    }),
    component: ({ props, renderNode }) => <Column>{renderNode(toChildArray(props.children))}</Column>,
  });
}

const LeftColumnRegion = columnComponent(
  "LeftColumn",
  "The left grid column: profile, vital signs and quick trends.",
  LeftColumn,
);
const CenterColumnRegion = columnComponent(
  "CenterColumn",
  "The centre grid column: orb, greeting, voice and the insight band.",
  CenterColumn,
);
const RightColumnRegion = columnComponent(
  "RightColumn",
  "The right grid column: overall readiness, its detail tabs and the mini cards.",
  RightColumn,
);

const Footer = defineComponent({
  name: "Footer",
  description:
    "A dismissable hint shown only while the agent-composed layout is active; renders nothing otherwise.",
  props: z.object({}),
  component: () => {
    const ctx = useHudScope();
    return (
      <>
        {ctx.composeOrigin === "agent" && !ctx.composeHintDismissed ? (
          <button
            type="button"
            className={HUD_GEN_COMPOSE_HINT}
            aria-label={ctx.copy.hud.composeHintDismissAria}
            onClick={() => ctx.onAction?.({ type: "DismissComposeHint", params: {} })}
          >
            <span>{ctx.composeHint}</span>
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </>
    );
  },
});

const Surface = defineComponent({
  name: "Surface",
  description:
    "The root of the HUD display tree. One Surface per screen: a Header, the three grid columns and a Footer.",
  props: z.object({
    children: z
      .array(z.union([Header.ref, LeftColumnRegion.ref, CenterColumnRegion.ref, RightColumnRegion.ref, Footer.ref]))
      .describe("The regions of the HUD, in display order"),
  }),
  component: ({ props, renderNode }) => {
    const children = toChildArray(props.children);
    const header = children.filter((child) => childTypeName(child) === "Header");
    const footer = children.filter((child) => childTypeName(child) === "Footer");
    const columns = children.filter((child) => {
      const name = childTypeName(child);
      return name === "LeftColumn" || name === "CenterColumn" || name === "RightColumn";
    });
    return (
      <>
        {renderNode(header)}
        <div className={MOCK_GRID}>{renderNode(columns)}</div>
        {renderNode(footer)}
      </>
    );
  },
});

export const hudLibrary = createLibrary({
  components: [
    Surface,
    Header,
    LeftColumnRegion,
    CenterColumnRegion,
    RightColumnRegion,
    ProfileCardRegion,
    VitalsCardRegion,
    TrendsCardRegion,
    OrbStageRegion,
    GreetingStackRegion,
    VoiceWaveRegion,
    VoiceClusterRegion,
    InsightBandRegion,
    ReadinessCardRegion,
    ReadinessTabsRegion,
    MiniCardsRegion,
    Footer,
    Fact,
    Alert,
  ],
  root: "Surface",
  actions: [openMission, changeAstronaut, toggleChat, toggleMic, dismissComposeHint],
});

const parser = createParser(hudLibrary.toJSONSchema(), hudLibrary.root);

/** Parses a program against this catalog, for `reviewProgram`. */
export const parseHudProgram: ParseProgram = (source) => parser.parse(source);

