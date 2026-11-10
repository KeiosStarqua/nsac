import { createLibrary, createParser, defineComponent } from "@openuidev/react-lang";
import { Link } from "@tanstack/react-router";
import { createContext, useContext, type ReactNode } from "react";
import { z } from "zod/v4";
import { useCopy, useLocale } from "~/shared/i18n";
import { FACT_IDS, FACT_META, GO_TO_TARGETS, type FactId, type GoToTarget } from "~/shared/sky";
import { SOURCES } from "~/shared/sources";
import { ExternalLink } from "~/shared/ui";
import { hasDigit, type ParseProgram } from "../model/program";
import styles from "./library.module.css";

// The OpenUI component catalog Sky composes panels from. It is deliberately small so a local model can
// follow the prompt, and it carries no actions: a panel explains and links, it never changes state.

/** Facts this station may show. Set by the panel around each `Renderer`. */
const AllowedFactsContext = createContext<readonly FactId[]>([]);

export function AllowedFacts({ facts, children }: { facts: readonly FactId[]; children: ReactNode }) {
  return <AllowedFactsContext.Provider value={facts}>{children}</AllowedFactsContext.Provider>;
}

// Render-time guards. A streamed draft is shown before it is reviewed, so text with a digit and facts this
// station does not allow are dropped while it streams; `reviewProgram` then rejects the whole draft.
const safeText = (text: string | undefined) => (text && !hasDigit(text) ? text : null);

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
  description: "A sourced fact with its value and link. The only way to show a number.",
  props: z.object({ id: z.enum(FACT_IDS).describe("Fact id") }),
  component: ({ props }) => <FactRow id={props.id} />,
});

function FactRow({ id }: { id: FactId }) {
  const copy = useCopy();
  const allowed = useContext(AllowedFactsContext);
  if (!allowed.includes(id)) return null;

  const fact = copy.sky.facts[id];
  const meta = FACT_META[id];
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{fact.label}</span>
      <strong className={styles.factValue}>{fact.value}</strong>
      <span className={styles.factSource}>
        {copy.sky.sourceLabel}:{" "}
        <ExternalLink href={SOURCES[meta.source].url}>
          {copy.sources.items[meta.source].label}
          {meta.requirement ? ` [${meta.requirement}]` : ""}
        </ExternalLink>
      </span>
    </div>
  );
}

const Steps = defineComponent({
  name: "Steps",
  description: "An ordered list of two to four short steps. No digits.",
  props: z.object({ items: z.array(z.string()).describe("Steps in order") }),
  component: ({ props }) => {
    const items = props.items.map(safeText).filter((item): item is string => item !== null);
    return items.length > 0 ? (
      <ol className={styles.steps}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    ) : null;
  },
});

const Note = defineComponent({
  name: "Note",
  description: "A short callout. Use caution for safety reminders. No digits.",
  props: z.object({
    tone: z.enum(["info", "caution"]).describe("info or caution"),
    text: z.string().describe("The note"),
  }),
  component: ({ props }) => {
    const text = safeText(props.text);
    return text ? (
      <p className={styles.note} data-tone={props.tone}>
        {text}
      </p>
    ) : null;
  },
});

const GoTo = defineComponent({
  name: "GoTo",
  description: "A link to another part of the site. The label is fixed by the site.",
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
    default:
      return (
        <Link className={styles.goTo} to="/" hash={target} search={{ lang }}>
          {label}
        </Link>
      );
  }
}

const SkyCard = defineComponent({
  name: "SkyCard",
  description: "The panel Sky shows where it landed. Two to five children.",
  props: z.object({
    title: z.string().describe("Short title, no digits"),
    children: z.array(z.union([Say.ref, Fact.ref, Steps.ref, Note.ref, GoTo.ref])).describe("Panel content"),
  }),
  component: ({ props, renderNode }) => (
    <div className={styles.card}>
      <h3 className={styles.title}>{safeText(props.title)}</h3>
      <div className={styles.body}>{renderNode(props.children)}</div>
    </div>
  ),
});

export const skyLibrary = createLibrary({
  components: [SkyCard, Say, Fact, Steps, Note, GoTo],
  root: "SkyCard",
});

const parser = createParser(skyLibrary.toJSONSchema(), skyLibrary.root);

/** Parses a program against this catalog, for `reviewProgram`. */
export const parseSkyProgram: ParseProgram = (source) => parser.parse(source);
