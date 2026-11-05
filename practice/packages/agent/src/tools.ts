import { createTool } from "@mastra/core/tools";
import { INTERVENTION_PATTERN } from "@practice/sim";
import { z } from "zod";
import { readScenario, replay } from "./scenario-context";

const WHAT_IF_HORIZON_DAYS = 14;

export const getOutbreakStatus = createTool({
  id: "get-outbreak-status",
  description:
    "Current flu situation on the ship: counts per health state, each crew member, and the most recent story events.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    day: z.number(),
    counts: z.object({
      susceptible: z.number(),
      exposed: z.number(),
      infectious: z.number(),
      recovered: z.number(),
      quarantined: z.number(),
    }),
    measures: z.object({ masks: z.boolean(), ventilation: z.boolean() }),
    crew: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        module: z.string(),
        health: z.string(),
        severity: z.number(),
        quarantined: z.boolean(),
      }),
    ),
    recentEvents: z.array(z.object({ day: z.number(), title: z.string(), severity: z.string() })),
  }),
  execute: async (_input, context) => {
    const scenario = readScenario(context.requestContext);
    const { state, series } = replay(scenario);
    const counts = series[series.length - 1]!;
    return {
      day: state.day,
      counts: {
        susceptible: counts.susceptible,
        exposed: counts.exposed,
        infectious: counts.infectious,
        recovered: counts.recovered,
        quarantined: counts.quarantined,
      },
      measures: state.measures,
      crew: state.crew.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        module: m.module,
        health: m.health,
        severity: m.severity,
        quarantined: m.quarantined,
      })),
      recentEvents: state.events.slice(-5).map((e) => ({ day: e.day, title: e.title, severity: e.severity })),
    };
  },
});

export const getTrend = createTool({
  id: "get-trend",
  description: "Number of sick (infectious) crew for every day from day 0 to today, in day order.",
  inputSchema: z.object({}),
  outputSchema: z.object({ sickPerDay: z.array(z.number()), exposedPerDay: z.array(z.number()) }),
  execute: async (_input, context) => {
    const { series } = replay(readScenario(context.requestContext));
    return {
      sickPerDay: series.map((s) => s.infectious),
      exposedPerDay: series.map((s) => s.exposed),
    };
  },
});

export const whatIf = createTool({
  id: "what-if",
  description: `Replays the simulation ${WHAT_IF_HORIZON_DAYS} days ahead with and without one action, and returns how many crew members get the flu in total. Use it to justify a ConfirmAction. interventionId: masks, ventilation, quarantine:<crewId> or release:<crewId>.`,
  inputSchema: z.object({
    interventionId: z
      .string()
      .describe("One of: masks, ventilation, quarantine:c1..c8, release:c1..c8"),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    interventionId: z.string(),
    horizonDay: z.number(),
    totalIllWithoutAction: z.number(),
    totalIllWithAction: z.number(),
    peakSickWithoutAction: z.number(),
    peakSickWithAction: z.number(),
  }),
  execute: async ({ interventionId }, context) => {
    const scenario = readScenario(context.requestContext);
    const horizonDay = scenario.day + WHAT_IF_HORIZON_DAYS;
    const token = `${scenario.day + 1}:${interventionId}`;
    const valid = INTERVENTION_PATTERN.test(token);
    const base = replay(scenario, [], horizonDay);
    const alt = valid ? replay(scenario, [token], horizonDay) : base;
    const totalIll = (r: typeof base) => {
      const last = r.series[r.series.length - 1]!;
      return last.recovered + last.infectious + last.exposed;
    };
    const peak = (r: typeof base) => Math.max(...r.series.map((s) => s.infectious));
    return {
      valid,
      interventionId,
      horizonDay,
      totalIllWithoutAction: totalIll(base),
      totalIllWithAction: totalIll(alt),
      peakSickWithoutAction: peak(base),
      peakSickWithAction: peak(alt),
    };
  },
});
