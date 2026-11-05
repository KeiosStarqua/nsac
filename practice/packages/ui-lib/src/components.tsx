import { defineComponent, useIsStreaming, useTriggerAction } from "@openuidev/react-lang";
import { z } from "zod";

const status = z.enum(["ok", "watch", "alert"]);
const health = z.enum(["susceptible", "exposed", "infectious", "recovered"]);

export const Stack = defineComponent({
  name: "Stack",
  description:
    "Root layout. Holds any other component in order. direction 'row' places children side by side, 'column' stacks them.",
  props: z.object({
    children: z.array(z.any()),
    direction: z.enum(["row", "column"]).optional(),
    gap: z.enum(["s", "m", "l"]).optional(),
  }),
  component: ({ props, renderNode }) => (
    <div className={`hl-stack hl-${props.direction ?? "column"} hl-gap-${props.gap ?? "m"}`}>
      {(props.children ?? []).map((child, i) => (
        <div key={i} className="hl-stack-item">
          {renderNode(child)}
        </div>
      ))}
    </div>
  ),
});

export const Heading = defineComponent({
  name: "Heading",
  description: "A section title.",
  props: z.object({ text: z.string(), level: z.enum(["1", "2", "3"]).optional() }),
  component: ({ props }) => {
    const Tag = (`h${props.level ?? "2"}` as "h1" | "h2" | "h3");
    return <Tag className="hl-heading">{props.text}</Tag>;
  },
});

export const Paragraph = defineComponent({
  name: "Paragraph",
  description: "A short plain-text paragraph. No markdown.",
  props: z.object({ text: z.string() }),
  component: ({ props }) => <p className="hl-paragraph">{props.text}</p>,
});

export const StatTile = defineComponent({
  name: "StatTile",
  description: "One headline number with a label. status colors the tile: ok, watch or alert.",
  props: z.object({
    label: z.string(),
    value: z.union([z.string(), z.number()]),
    unit: z.string().optional(),
    status: status.optional(),
    note: z.string().optional(),
  }),
  component: ({ props }) => (
    <div className={`hl-tile hl-status-${props.status ?? "ok"}`}>
      <div className="hl-tile-label">{props.label}</div>
      <div className="hl-tile-value">
        {props.value}
        {props.unit ? <span className="hl-tile-unit"> {props.unit}</span> : null}
      </div>
      {props.note ? <div className="hl-tile-note">{props.note}</div> : null}
    </div>
  ),
});

export const CrewCard = defineComponent({
  name: "CrewCard",
  description:
    "One crew member. health is the infection state. severity is 0 to 1 and says how sick they are today.",
  props: z.object({
    name: z.string(),
    role: z.string(),
    health,
    severity: z.number().optional(),
    quarantined: z.boolean().optional(),
  }),
  component: ({ props }) => {
    const sev = Math.max(0, Math.min(1, props.severity ?? 0));
    return (
      <div className={`hl-crew hl-health-${props.health}`}>
        <div className="hl-crew-name">{props.name}</div>
        <div className="hl-crew-role">{props.role}</div>
        <div className="hl-crew-state">
          {props.health}
          {props.quarantined ? " · isolated" : ""}
        </div>
        <div className="hl-meter" aria-label="severity">
          <div className="hl-meter-fill" style={{ width: `${Math.round(sev * 100)}%` }} />
        </div>
      </div>
    );
  },
});

export const TrendChart = defineComponent({
  name: "TrendChart",
  description: "A small bar chart of one number per day. values are in day order.",
  props: z.object({
    title: z.string(),
    values: z.array(z.number()),
    labels: z.array(z.string()).optional(),
  }),
  component: ({ props }) => {
    const values = props.values ?? [];
    const max = Math.max(1, ...values);
    const w = 8;
    const gap = 3;
    const h = 64;
    return (
      <figure className="hl-chart">
        <figcaption>{props.title}</figcaption>
        <svg viewBox={`0 0 ${Math.max(1, values.length) * (w + gap)} ${h}`} role="img" aria-label={props.title}>
          {values.map((v, i) => {
            const bh = (v / max) * (h - 4);
            return (
              <rect key={i} x={i * (w + gap)} y={h - bh} width={w} height={bh} rx={2}>
                <title>{`${props.labels?.[i] ?? `Day ${i}`}: ${v}`}</title>
              </rect>
            );
          })}
        </svg>
      </figure>
    );
  },
});

export const Callout = defineComponent({
  name: "Callout",
  description: "A highlighted message. severity: info, watch or alert.",
  props: z.object({
    title: z.string(),
    message: z.string(),
    severity: z.enum(["info", "watch", "alert"]).optional(),
  }),
  component: ({ props }) => (
    <aside className={`hl-callout hl-sev-${props.severity ?? "info"}`} role="note">
      <strong>{props.title}</strong>
      <span>{props.message}</span>
    </aside>
  ),
});

export const ConfirmAction = defineComponent({
  name: "ConfirmAction",
  description:
    "A proposed action that does nothing until the astronaut presses the button. interventionId is one of: masks, ventilation, quarantine:<crewId>, release:<crewId>. Use at most one per answer.",
  props: z.object({
    title: z.string(),
    rationale: z.string(),
    confirmLabel: z.string(),
    interventionId: z.string(),
  }),
  component: ({ props }) => {
    const trigger = useTriggerAction();
    const streaming = useIsStreaming();
    return (
      <div className="hl-confirm">
        <div className="hl-confirm-title">{props.title}</div>
        <p className="hl-confirm-why">{props.rationale}</p>
        <button
          type="button"
          className="hl-button"
          disabled={streaming || !props.interventionId}
          onClick={() =>
            trigger(props.confirmLabel, undefined, {
              type: "intervention",
              params: { id: props.interventionId },
            })
          }
        >
          {props.confirmLabel}
        </button>
        <small className="hl-disclaimer">AI-generated. Not a substitute for a physician.</small>
      </div>
    );
  },
});
