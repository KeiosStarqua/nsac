import { INTERVENTION_PATTERN } from "@practice/sim";
import { z } from "zod";

/** How many mission days the story covers. The animated page preloads all of them. */
export const HORIZON = 30;

const seedField = z.number().int().min(1).max(9999);
const dayField = z.number().int().min(0).max(HORIZON);
const ivField = z.array(z.string().regex(INTERVENTION_PATTERN)).max(12);

/**
 * URL search params shared by every page under the `_ship` layout. LENIENT on purpose:
 * a hand-edited or stale link falls back to a safe value instead of breaking the page.
 *   seed: which random story to tell
 *   day:  which mission day is on screen
 *   iv:   actions the astronaut confirmed, e.g. "4:masks" or "5:quarantine:c5"
 */
export const scenarioSearchSchema = z.object({
  seed: seedField.catch(7),
  day: dayField.catch(0),
  iv: ivField.catch([]),
});

export type ScenarioSearch = z.infer<typeof scenarioSearchSchema>;

/**
 * Same shape, STRICT. Use at trust boundaries (HTTP routes, server functions):
 * bad input is rejected, never silently repaired.
 */
export const scenarioInputSchema = z.object({ seed: seedField, day: dayField, iv: ivField });

/** The subset that changes the simulated story (everything except which day is on screen). */
export const timelineInputSchema = z.object({
  seed: seedField,
  iv: ivField,
  horizon: dayField,
});

export type TimelineInput = z.infer<typeof timelineInputSchema>;
