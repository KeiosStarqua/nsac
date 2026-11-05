import { INTERVENTION_PATTERN } from "@practice/sim";
import { replay, type AgentScenario } from "./scenario-context";

export interface Proposal {
  interventionId: string;
  title: string;
  rationale: string;
  confirmLabel: string;
}

const str = (s: string) => JSON.stringify(s);
const HORIZON = 14;

function totalIll(s: AgentScenario, extra: string[]): number {
  const { series } = replay(s, extra, s.day + HORIZON);
  const last = series[series.length - 1]!;
  return last.recovered + last.infectious + last.exposed;
}

/**
 * Deterministic rule: pick the one action with the clearest benefit. The LLM may explain it, never choose it.
 * Returns null when nothing is worth proposing.
 */
export function proposeNext(s: AgentScenario): Proposal | null {
  const { state } = replay(s);
  const sick = state.crew.filter((m) => m.health === "infectious" && !m.quarantined);
  const incubating = state.crew.filter((m) => m.health === "exposed");
  const next = s.day + 1;

  const candidates: Array<{ id: string; title: string; label: string; reason: string }> = [];
  const worst = [...sick].sort((a, b) => b.severity - a.severity)[0];
  if (worst) {
    candidates.push({
      id: `quarantine:${worst.id}`,
      title: `Isolate ${worst.name}`,
      label: `Confirm: isolate ${worst.name}`,
      reason: `${worst.name} (${worst.role}) is sick and works in the ${worst.module}.`,
    });
  }
  if (!state.measures.masks && (sick.length > 0 || incubating.length > 0)) {
    candidates.push({
      id: "masks",
      title: "Require masks in shared modules",
      label: "Confirm: masks in shared modules",
      reason: "Someone is sick or incubating, and the crew still shares the galley, lab and gym.",
    });
  }
  if (!state.measures.ventilation && sick.length > 0) {
    candidates.push({
      id: "ventilation",
      title: "Raise cabin air exchange",
      label: "Confirm: scrubbers on high",
      reason: "More air exchange lowers the chance of passing the virus between modules.",
    });
  }

  const baseline = totalIll(s, []);
  let best: { c: (typeof candidates)[number]; avoided: number } | null = null;
  for (const c of candidates) {
    if (!INTERVENTION_PATTERN.test(`${next}:${c.id}`)) continue;
    const avoided = baseline - totalIll(s, [`${next}:${c.id}`]);
    if (avoided > 0 && (!best || avoided > best.avoided)) best = { c, avoided };
  }
  if (!best) return null;
  return {
    interventionId: best.c.id,
    title: best.c.title,
    confirmLabel: best.c.label,
    rationale: `${best.c.reason} Replaying the next ${HORIZON} days: about ${best.avoided} fewer crew members get the flu (${baseline} without it).`,
  };
}

/** Same OpenUI Lang the model would write, built without a model. Used when Ollama is offline. */
export function buildBriefing(s: AgentScenario): string {
  const { state, series } = replay(s);
  const now = series[series.length - 1]!;
  const sickCrew = state.crew.filter((m) => m.health === "infectious" || m.health === "exposed").slice(0, 4);
  const proposal = proposeNext(s);

  const lines: string[] = [];
  const items: string[] = ["title", "tiles"];

  lines.push(`title = Heading(${str(`Day ${state.day} flu status`)}, "2")`);
  lines.push(`tiles = Stack([sick, incubating, recovered], "row", "m")`);
  lines.push(
    `sick = StatTile("Sick now", ${now.infectious}, "crew", ${str(now.infectious >= 3 ? "alert" : now.infectious > 0 ? "watch" : "ok")})`,
  );
  lines.push(`incubating = StatTile("Incubating", ${now.exposed}, "crew", ${str(now.exposed > 0 ? "watch" : "ok")})`);
  lines.push(`recovered = StatTile("Recovered", ${now.recovered}, "crew", "ok")`);

  if (series.length > 2) {
    items.push("chart");
    const values = series.map((p) => p.infectious).join(", ");
    const labels = series.map((p) => str(`D${p.day}`)).join(", ");
    lines.push(`chart = TrendChart("Sick crew per day", [${values}], [${labels}])`);
  }

  if (sickCrew.length > 0) {
    items.push("people");
    const ids = sickCrew.map((_, i) => `p${i}`);
    lines.push(`people = Stack([${ids.join(", ")}], "row", "s")`);
    sickCrew.forEach((m, i) => {
      lines.push(
        `p${i} = CrewCard(${str(m.name)}, ${str(m.role)}, ${str(m.health)}, ${m.severity}, ${m.quarantined})`,
      );
    });
  } else if (now.recovered > 0) {
    items.push("allclear");
    lines.push(
      `allclear = Callout("Nobody is sick", ${str(`${now.recovered} crew members recovered. Keep watching for new symptoms.`)}, "info")`,
    );
  } else {
    items.push("quiet");
    lines.push(`quiet = Callout("All quiet", "No flu signs on board yet.", "info")`);
  }

  if (proposal) {
    items.push("step");
    lines.push(
      `step = ConfirmAction(${str(proposal.title)}, ${str(proposal.rationale)}, ${str(proposal.confirmLabel)}, ${str(proposal.interventionId)})`,
    );
  }

  return [`root = Stack([${items.join(", ")}])`, ...lines].join("\n");
}
