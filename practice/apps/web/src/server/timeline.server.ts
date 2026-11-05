// Server-only: the `.server.ts` suffix keeps this file out of the client bundle.
import { parseInterventions, runTimeline } from "@practice/sim";
import type { TimelineInput } from "~/shared/scenario/search";
import type { TimelinePayload } from "~/shared/scenario/types";

export function buildTimeline(input: TimelineInput): TimelinePayload {
  const states = runTimeline(
    { config: { seed: input.seed }, interventions: parseInterventions(input.iv) },
    input.horizon,
  );
  const first = states[0]!;
  const last = states[states.length - 1]!;

  return {
    roster: first.crew.map((m) => ({ id: m.id, name: m.name, role: m.role, module: m.module })),
    frames: states.map((s) => ({
      day: s.day,
      measures: s.measures,
      summary: {
        day: s.day,
        susceptible: s.crew.filter((m) => m.health === "susceptible").length,
        exposed: s.crew.filter((m) => m.health === "exposed").length,
        infectious: s.crew.filter((m) => m.health === "infectious").length,
        recovered: s.crew.filter((m) => m.health === "recovered").length,
        quarantined: s.crew.filter((m) => m.quarantined).length,
      },
      crew: s.crew.map((m) => ({
        id: m.id,
        health: m.health,
        severity: m.severity,
        quarantined: m.quarantined,
      })),
    })),
    events: last.events,
  };
}
