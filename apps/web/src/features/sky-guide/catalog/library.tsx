import { createLibrary, createParser, defineComponent } from "@openuidev/react-lang";
import { Link } from "@tanstack/react-router";
import { createContext, useContext, type ReactNode } from "react";
import { z } from "zod/v4";
import { Alert as ArcAlert } from "~/components/arc/alert/alert";
import { Badge as ArcBadge } from "~/components/arc/badge/badge";
import { Card as ArcCard } from "~/components/arc/card/card";
import { Stepper as ArcStepper } from "~/components/arc/stepper/stepper";
import { useCopy, useLocale } from "~/shared/i18n";
import { FACT_IDS, FACT_META, GO_TO_TARGETS, type FactId, type GoToTarget } from "~/shared/sky";
import { SOURCES } from "~/shared/sources";
import { ExternalLink } from "~/shared/ui";
import { hasDigit, type ParseProgram } from "../model/program";
import styles from "./library.module.css";

// The OpenUI catalog Sky composes with. Every piece is a uiarc.dev component
// (https://uiarc.dev, MIT), so a panel written by the local model looks like the app itself.
//
// The catalog stays small on purpose: a small local model has to follow it.
// Sky's own rules still hold here:
//   - a panel has no action that changes state; the only interactive element is a link out;
//   - a number reaches a panel only through Fact(id), whose value and source come from the copy;
//   - free text never carries a digit (checked in model/program.ts).

/** What the page around a panel allows: the facts it may show, and the heading level of its title. */
export interface PanelScope {
  readonly facts: readonly FactId[];
  /** `one` when the panel is the whole page, `two` when it sits inside a page that has its own title. */
  readonly headingLevel: "one" | "two";
}

const PanelScopeContext = createContext<PanelScope>({ facts: [], headingLevel: "two" });

export function PanelScopeProvider({ scope, children }: { scope: PanelScope; children: ReactNode }) {
  return <PanelScopeContext.Provider value={scope}>{children}</PanelScopeContext.Provider>;
}

// Render-time guards. A streamed draft is shown before it is reviewed, so text with a digit and facts this
// station does not allow are dropped while it streams; `reviewProgram` then rejects the whole draft.
const safeText = (text: string | undefined) => (text && !hasDigit(text) ? text : null);

const ALERT_TONES = ["info", "caution", "success", "danger"] as const;
type AlertTone = (typeof ALERT_TONES)[number];

const ALERT_TONE_MAP: Record<AlertTone, "info" | "success" | "warning" | "danger"> = {
  info: "info",
  caution: "warning",
  success: "success",
  danger: "danger",
};

const BADGE_TONES = ["neutral", "info", "success", "warning", "danger"] as const;
type BadgeTone = (typeof BADGE_TONES)[number];

const Say = defineComponent({
  name: "Say",
  description: "One or two short sentences Sky says, in the first person. No digits.",
  props: z.object({ text: z.string().describe("What Sky says") }),
  component: ({ props }) => {
    const text = safeText(props.text);
    return text ? <p className={styles.say}>{text}</p> : null;
  },
});

const Fact = defineComponent({
  name: "Fact",
  description: "A sourced value. The only way a number reaches a panel.",
  props: z.object({ id: z.enum(FACT_IDS).describe("Fact id") }),
  component: ({ props }) => <FactRow id={props.id} />,
});

function FactRow({ id }: { id: FactId }) {
  const copy = useCopy();
  const { facts: allowed } = useContext(PanelScopeContext);
  if (!allowed.includes(id)) return null;

  const fact = copy.sky.facts[id];
  const meta = FACT_META[id];
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{fact.label}</span>
      <strong className={styles.factValue}>{fact.value}</strong>
      {/* Only a NASA-STD-3001 limit carries its source; contextual facts show label and value only. */}
      {meta.requirement ? (
        <span className={styles.factSource}>
          {copy.sky.sourceLabel}:{" "}
          <ExternalLink href={SOURCES[meta.source].url}>
            {copy.sources.items[meta.source].label}
            {` [${meta.requirement}]`}
          </ExternalLink>
        </span>
      ) : null}
    </div>
  );
}

const Badge = defineComponent({
  name: "Badge",
  description: "A short status chip, for example offline or simulated data.",
  props: z.object({
    label: z.string().describe("Chip label"),
    tone: z.enum(BADGE_TONES).optional().describe("Chip tone"),
  }),
  component: ({ props }) => {
    const label = safeText(props.label);
    if (!label) return null;
    return (
      <ArcBadge tone={props.tone ?? "neutral"} size="sm" pill>
        {label}
      </ArcBadge>
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
      <ArcAlert tone={ALERT_TONE_MAP[props.tone]} title={title}>
        {body}
      </ArcAlert>
    );
  },
});

const Steps = defineComponent({
  name: "Steps",
  description: "An ordered list of two to four short steps.",
  props: z.object({ items: z.array(z.string()).describe("Steps in order") }),
  component: ({ props }) => {
    const copy = useCopy();
    const items = props.items.map(safeText).filter((item): item is string => item !== null);
    if (items.length === 0) return null;
    return (
      <ArcStepper
        steps={items.map((label, index) => ({ id: `step-${index}`, label }))}
        current={0}
        orientation="vertical"
        details="all"
        label={copy.sky.stepsLabel}
      />
    );
  },
});

const GoTo = defineComponent({
  name: "GoTo",
  description: "A link to another part of the site.",
  props: z.object({ target: z.enum(GO_TO_TARGETS).describe("Where to go") }),
  component: ({ props }) => <GoToLink target={props.target} />,
});

function GoToLink({ target }: { target: GoToTarget }) {
  const copy = useCopy();
  const lang = useLocale();
  const label = copy.sky.goTo[target];
  switch (target) {
    case "demo":
      return (
        <Link className={styles.goTo} to="/demo" search={{ lang }}>
          {label}
        </Link>
      );
    case "story":
      return (
        <Link className={styles.goTo} to="/story" search={{ lang }}>
          {label}
        </Link>
      );
    case "concept":
      return (
        <Link className={styles.goTo} to="/concept" search={{ lang }}>
          {label}
        </Link>
      );
    default:
      // The rest of the product description lives on /concept now.
      return (
        <Link className={styles.goTo} to="/concept" hash={target} search={{ lang }}>
          {label}
        </Link>
      );
  }
}

const Card = defineComponent({
  name: "Card",
  description: "A card of the console. Two to five children.",
  props: z.object({
    title: z.string().describe("Short title of the card"),
    children: z
      .array(z.union([Say.ref, Fact.ref, Badge.ref, Alert.ref, Steps.ref, GoTo.ref]))
      .describe("What the card holds"),
  }),
  component: ({ props, renderNode }) => {
    const title = safeText(props.title);
    if (!title) return null;
    return (
      <ArcCard title={title}>
        <div className={styles.cardBody}>{renderNode(props.children)}</div>
      </ArcCard>
    );
  },
});

const Console = defineComponent({
  name: "Console",
  description: "The console surface: a title and two to five cards.",
  props: z.object({
    title: z.string().describe("The title of the console"),
    children: z.array(z.union([Card.ref, Alert.ref])).describe("The cards of the console"),
  }),
  component: ({ props, renderNode }) => {
    const title = safeText(props.title);
    if (!title) return null;
    const { headingLevel } = useContext(PanelScopeContext);
    const Heading = headingLevel === "one" ? "h1" : "h2";
    return (
      <div className={styles.console}>
        <Heading className={styles.consoleTitle}>{title}</Heading>
        <div className={styles.grid}>{renderNode(props.children)}</div>
      </div>
    );
  },
});

export const skyLibrary = createLibrary({
  components: [Console, Card, Say, Fact, Badge, Alert, Steps, GoTo],
  root: "Console",
});

const parser = createParser(skyLibrary.toJSONSchema(), skyLibrary.root);

/** Parses a program against this catalog, for `reviewProgram`. */
export const parseSkyProgram: ParseProgram = (source) => parser.parse(source);
