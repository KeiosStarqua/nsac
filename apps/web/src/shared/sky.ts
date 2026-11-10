import { z } from "zod";
import type { SourceId } from "./sources";

// Ids shared by the Sky guide feature and the i18n copy. They live in `shared/` because the `Copy` type
// is keyed by them and `shared/` never imports features.

/** A station is a place on a page where Sky lands and composes a panel with OpenUI. */
export const STATION_IDS = ["welcome", "hazards", "data", "pipeline", "readiness", "story"] as const;
export const StationIdSchema = z.enum(STATION_IDS);
export type StationId = z.infer<typeof StationIdSchema>;

/**
 * Facts are the only way a number reaches a Sky panel. The model may pick a fact id, never write a value:
 * labels and values come from the i18n copy, and the source link from here.
 */
export const FACT_IDS = [
  "tripLength",
  "marsGravity",
  "radiationCareer",
  "radiationSolar",
  "muscleStrength",
  "aerobicSurface",
] as const;
export const FactIdSchema = z.enum(FACT_IDS);
export type FactId = z.infer<typeof FactIdSchema>;

export interface FactMeta {
  readonly source: SourceId;
  /** NASA-STD-3001 Vol. 1 Rev B requirement, when the value is one of its limits. */
  readonly requirement?: string;
}

export const FACT_META: Readonly<Record<FactId, FactMeta>> = {
  tripLength: { source: "fiveHazards" },
  marsGravity: { source: "marsGravity" },
  radiationCareer: { source: "nasaStd3001", requirement: "V1 4030" },
  radiationSolar: { source: "nasaStd3001", requirement: "V1 4031" },
  muscleStrength: { source: "nasaStd3001", requirement: "V1 4024" },
  aerobicSurface: { source: "nasaStd3001", requirement: "V1 4002" },
};

/** Which facts each station may show. Anything else in a generated panel is rejected. */
export const STATION_FACTS: Readonly<Record<StationId, readonly FactId[]>> = {
  welcome: ["tripLength", "marsGravity"],
  hazards: ["radiationCareer", "radiationSolar", "marsGravity"],
  data: ["muscleStrength", "aerobicSurface", "radiationCareer"],
  pipeline: [],
  readiness: ["marsGravity", "muscleStrength"],
  story: ["tripLength"],
};

/** In-app destinations a panel may link to. Labels come from the copy, never from the model. */
export const GO_TO_TARGETS = ["demo", "story", "hazards", "data", "sources"] as const;
export const GoToTargetSchema = z.enum(GO_TO_TARGETS);
export type GoToTarget = z.infer<typeof GoToTargetSchema>;
