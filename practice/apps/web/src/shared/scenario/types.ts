import type { DaySummary, HealthState, Measures, ModuleId, StoryEvent } from "@practice/sim";

/** Plain JSON that crosses the server -> client boundary. */
export interface RosterEntry {
  id: string;
  name: string;
  role: string;
  module: ModuleId;
}

export interface FrameCrew {
  id: string;
  health: HealthState;
  severity: number;
  quarantined: boolean;
}

export interface Frame {
  day: number;
  summary: DaySummary;
  measures: Measures;
  crew: FrameCrew[];
}

export interface TimelinePayload {
  roster: RosterEntry[];
  frames: Frame[];
  events: StoryEvent[];
}

export interface BriefingPayload {
  /** OpenUI Lang program. */
  text: string;
  source: "built-in";
  proposalId: string | null;
}
