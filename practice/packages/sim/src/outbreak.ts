import { createCrew } from "./crew";
import { mixSeed, mulberry32, randInt } from "./rng";
import type {
  CrewMember,
  DaySummary,
  Intervention,
  OutbreakConfig,
  OutbreakState,
  StoryEvent,
} from "./types";

export const DEFAULT_CONFIG: OutbreakConfig = {
  seed: 7,
  beta: 0.18,
  crossMixing: 0.35,
  quarantineLeak: 0.05,
  maskReduction: 0.4,
  ventilationReduction: 0.3,
  incubationRange: [1, 3],
  illnessRange: [4, 7],
  patientZeroId: "c5",
  seedDay: 2,
};

export function createOutbreak(overrides: Partial<OutbreakConfig> = {}): OutbreakState {
  const config: OutbreakConfig = { ...DEFAULT_CONFIG, ...overrides };
  return {
    day: 0,
    config,
    crew: createCrew(),
    measures: { masks: false, ventilation: false },
    events: [],
  };
}

export function summarize(state: OutbreakState): DaySummary {
  const count = (h: CrewMember["health"]) => state.crew.filter((m) => m.health === h).length;
  return {
    day: state.day,
    susceptible: count("susceptible"),
    exposed: count("exposed"),
    infectious: count("infectious"),
    recovered: count("recovered"),
    quarantined: state.crew.filter((m) => m.quarantined).length,
  };
}

function nameOf(state: OutbreakState, id: string): string {
  return state.crew.find((m) => m.id === id)?.name ?? id;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Applies one confirmed intervention at the start of `day`. Pure. */
export function applyIntervention(state: OutbreakState, iv: Intervention, day: number): OutbreakState {
  const events: StoryEvent[] = [...state.events];
  let measures = state.measures;
  let crew = state.crew;

  switch (iv.type) {
    case "masks":
      if (measures.masks) return state;
      measures = { ...measures, masks: true };
      events.push({
        day,
        kind: "measure",
        memberIds: [],
        title: "Masks required in shared modules",
        detail: "The crew confirms a mask rule for the galley, lab and gym.",
        severity: "info",
      });
      break;
    case "ventilation":
      if (measures.ventilation) return state;
      measures = { ...measures, ventilation: true };
      events.push({
        day,
        kind: "measure",
        memberIds: [],
        title: "Cabin air scrubbers on high",
        detail: "Extra air exchange lowers the chance of passing the virus between modules.",
        severity: "info",
      });
      break;
    case "quarantine": {
      const target = crew.find((m) => m.id === iv.memberId);
      if (!target || target.quarantined) return state;
      crew = crew.map((m) => (m.id === iv.memberId ? { ...m, quarantined: true } : m));
      events.push({
        day,
        kind: "measure",
        memberIds: [iv.memberId],
        title: `${target.name} moves to the isolation bunk`,
        detail: "Contact with the rest of the crew drops to almost nothing.",
        severity: "watch",
      });
      break;
    }
    case "release": {
      const target = crew.find((m) => m.id === iv.memberId);
      if (!target || !target.quarantined) return state;
      crew = crew.map((m) => (m.id === iv.memberId ? { ...m, quarantined: false } : m));
      events.push({
        day,
        kind: "measure",
        memberIds: [iv.memberId],
        title: `${target.name} leaves isolation`,
        detail: "Back to normal duties.",
        severity: "info",
      });
      break;
    }
  }
  return { ...state, measures, crew, events };
}

function contactWeight(config: OutbreakConfig, a: CrewMember, b: CrewMember): number {
  const base = a.module === b.module ? 1 : config.crossMixing;
  const leak = config.quarantineLeak;
  return base * (a.quarantined ? leak : 1) * (b.quarantined ? leak : 1);
}

/** Advance exactly one day. Pure: same input state gives the same output. */
export function advanceDay(state: OutbreakState): OutbreakState {
  const { config } = state;
  const day = state.day + 1;
  const rng = mulberry32(mixSeed(config.seed, day));
  const reduction =
    (state.measures.masks ? 1 - config.maskReduction : 1) *
    (state.measures.ventilation ? 1 - config.ventilationReduction : 1);

  const infectious = state.crew.filter((m) => m.health === "infectious");
  const events: StoryEvent[] = [...state.events];
  const newlyExposed: string[] = [];
  const newlySick: string[] = [];
  const newlyRecovered: string[] = [];

  const crew = state.crew.map((m): CrewMember => {
    const aged = { ...m, daysInState: m.daysInState + 1 };

    if (m.health === "susceptible") {
      const isIndexCase = day === config.seedDay && m.id === config.patientZeroId;
      let escape = 1;
      for (const source of infectious) {
        escape *= 1 - Math.min(1, config.beta * reduction * contactWeight(config, m, source));
      }
      const draw = rng();
      if (isIndexCase || draw < 1 - escape) {
        newlyExposed.push(m.id);
        return {
          ...m,
          health: "exposed",
          daysInState: 0,
          incubationDays: randInt(rng, ...config.incubationRange),
          illnessDays: randInt(rng, ...config.illnessRange),
          severity: 0,
        };
      }
      return aged;
    }

    if (m.health === "exposed" && aged.daysInState >= m.incubationDays) {
      newlySick.push(m.id);
      return { ...aged, health: "infectious", daysInState: 0, severity: 0.3 };
    }

    if (m.health === "infectious") {
      if (aged.daysInState >= m.illnessDays) {
        newlyRecovered.push(m.id);
        return { ...aged, health: "recovered", daysInState: 0, severity: 0, quarantined: false };
      }
      const phase = (aged.daysInState + 0.5) / m.illnessDays;
      return { ...aged, severity: Math.round((0.3 + 0.7 * Math.sin(Math.PI * phase)) * 100) / 100 };
    }

    return aged;
  });

  const next: OutbreakState = { ...state, day, crew, events };
  const nameList = (ids: string[]) => joinNames(ids.map((id) => nameOf(next, id)));

  if (newlyExposed.length > 0) {
    const first = day === config.seedDay && newlyExposed.includes(config.patientZeroId);
    events.push(
      first
        ? {
            day,
            kind: "index-case",
            memberIds: [config.patientZeroId],
            title: `${nameOf(next, config.patientZeroId)} was exposed`,
            detail: "A contaminated supply item brought the virus aboard. Nobody feels anything yet.",
            severity: "info",
          }
        : {
            day,
            kind: "exposure",
            memberIds: newlyExposed,
            title: `${nameList(newlyExposed)} caught the virus`,
            detail: "Shared air and shared tables carried it across the modules.",
            severity: "watch",
          },
    );
  }
  if (newlySick.length > 0) {
    events.push({
      day,
      kind: "symptoms",
      memberIds: newlySick,
      title: `${nameList(newlySick)} developed flu symptoms`,
      detail: "Fever, cough and tiredness. Workouts and sleep both suffer.",
      severity: "alert",
    });
  }
  if (newlyRecovered.length > 0) {
    events.push({
      day,
      kind: "recovery",
      memberIds: newlyRecovered,
      title: `${nameList(newlyRecovered)} recovered`,
      detail: "Fever gone. Back on the exercise schedule, slowly.",
      severity: "info",
    });
  }

  const s = summarize(next);
  const prevInfectious = infectious.length;
  const hadPeak = events.some((e) => e.kind === "peak");
  if (!hadPeak && prevInfectious >= 2 && s.infectious < prevInfectious) {
    events.push({
      day,
      kind: "peak",
      memberIds: [],
      title: "The outbreak peaked",
      detail: `${prevInfectious} crew members were sick at once.`,
      severity: "watch",
    });
  }
  const done = s.exposed === 0 && s.infectious === 0 && s.recovered > 0;
  if (done && !events.some((e) => e.kind === "contained")) {
    events.push({
      day,
      kind: "contained",
      memberIds: [],
      title: "Outbreak over",
      detail: `${s.recovered} of ${state.crew.length} crew members had the flu. Nobody is sick now.`,
      severity: "info",
    });
  }

  return next;
}
