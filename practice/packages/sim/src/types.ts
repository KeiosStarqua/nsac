export type ModuleId = "habitat" | "lab" | "galley" | "gym";

export const MODULES: readonly ModuleId[] = ["habitat", "lab", "galley", "gym"];

export type HealthState = "susceptible" | "exposed" | "infectious" | "recovered";

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  /** Module where this person spends most of the day. */
  module: ModuleId;
  health: HealthState;
  /** Days spent in the current health state. */
  daysInState: number;
  /** Sampled length of the incubation period (exposed -> infectious). */
  incubationDays: number;
  /** Sampled length of the illness (infectious -> recovered). */
  illnessDays: number;
  /** 0..1, how sick the person looks today. Drives animation intensity. */
  severity: number;
  quarantined: boolean;
}

/**
 * Toy parameters. Not medical data; chosen to make a readable story.
 * Replace with cited values before using this for anything real.
 */
export interface OutbreakConfig {
  seed: number;
  /** Per-day transmission probability for one infectious contact at full weight. */
  beta: number;
  /** Contact weight between people in different modules (same module = 1). */
  crossMixing: number;
  /** Fraction of contact weight a quarantined infectious person keeps. */
  quarantineLeak: number;
  maskReduction: number;
  ventilationReduction: number;
  incubationRange: readonly [number, number];
  illnessRange: readonly [number, number];
  /** Member who brings the virus aboard (index case). */
  patientZeroId: string;
  /** Mission day the index case becomes exposed. */
  seedDay: number;
}

export type Intervention =
  | { day: number; type: "masks" }
  | { day: number; type: "ventilation" }
  | { day: number; type: "quarantine"; memberId: string }
  | { day: number; type: "release"; memberId: string };

export interface Measures {
  masks: boolean;
  ventilation: boolean;
}

export type StoryKind =
  | "index-case"
  | "exposure"
  | "symptoms"
  | "recovery"
  | "measure"
  | "peak"
  | "contained";

export type Severity = "info" | "watch" | "alert";

export interface StoryEvent {
  day: number;
  kind: StoryKind;
  memberIds: string[];
  title: string;
  detail: string;
  severity: Severity;
}

export interface OutbreakState {
  day: number;
  config: OutbreakConfig;
  crew: CrewMember[];
  measures: Measures;
  /** Every event up to and including `day`. */
  events: StoryEvent[];
}

export interface DaySummary {
  day: number;
  susceptible: number;
  exposed: number;
  infectious: number;
  recovered: number;
  quarantined: number;
}
