import { z } from "zod";

// Pure demo model. No IO, safe on both client and server.
// All values are illustrative, from the project's 60-second demo script (README "Demo (60 giây)"):
// day ~170, readiness 62 (yellow) -> recovery dose -> Confirm -> fast-forward -> 81 (green).
// They are NOT medical thresholds. The real app shows its formula with a source for every weight.

export const STAGES = ["alert", "confirmed", "fastForwarded"] as const;
export const StageSchema = z.enum(STAGES);
export type Stage = z.infer<typeof StageSchema>;

export type Severity = "yellow" | "green";
export type LinkState = "idle" | "queued" | "delivered";

export interface ScenarioParams {
  readonly startDay: number;
  readonly endDay: number;
  readonly startScore: number;
  readonly endScore: number;
}

export interface Snapshot {
  readonly day: number;
  readonly score: number;
  readonly severity: Severity;
}

/** The score a stage shows when it is not being animated. */
export function snapshotFor(stage: Stage, params: ScenarioParams): Snapshot {
  return stage === "fastForwarded"
    ? { day: params.endDay, score: params.endScore, severity: "green" }
    : { day: params.startDay, score: params.startScore, severity: "yellow" };
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** One snapshot per day from `startDay` to `endDay`, easing from the start score to the end score. */
export function trajectory(params: ScenarioParams): Snapshot[] {
  const span = params.endDay - params.startDay;
  if (span <= 0) return [snapshotFor("fastForwarded", params)];

  return Array.from({ length: span + 1 }, (_, i) => {
    const day = params.startDay + i;
    const score = Math.round(
      params.startScore + (params.endScore - params.startScore) * easeOutCubic(i / span),
    );
    return { day, score, severity: day === params.endDay ? "green" : "yellow" };
  });
}

/** Nothing is queued or sent until the astronaut confirms. */
export function linkStateFor(stage: Stage): LinkState {
  if (stage === "alert") return "idle";
  return stage === "confirmed" ? "queued" : "delivered";
}

export const canConfirm = (stage: Stage) => stage === "alert";
export const canFastForward = (stage: Stage) => stage === "confirmed";

export const DemoSearchSchema = z.object({ stage: StageSchema.catch("alert") });
