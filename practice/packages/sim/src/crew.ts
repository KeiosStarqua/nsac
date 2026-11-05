import type { CrewMember, ModuleId } from "./types";

/** Fictional crew. No real people; names are placeholders. */
const ROSTER: ReadonlyArray<{ id: string; name: string; role: string; module: ModuleId }> = [
  { id: "c1", name: "Ari", role: "Commander", module: "habitat" },
  { id: "c2", name: "Bao", role: "Flight Engineer", module: "lab" },
  { id: "c3", name: "Chen", role: "Medical Officer", module: "habitat" },
  { id: "c4", name: "Dara", role: "Biologist", module: "lab" },
  { id: "c5", name: "Elif", role: "Pilot", module: "galley" },
  { id: "c6", name: "Farid", role: "Systems Specialist", module: "gym" },
  { id: "c7", name: "Gia", role: "Geologist", module: "lab" },
  { id: "c8", name: "Hana", role: "Mission Specialist", module: "galley" },
];

export function createCrew(): CrewMember[] {
  return ROSTER.map((r) => ({
    ...r,
    health: "susceptible",
    daysInState: 0,
    incubationDays: 0,
    illnessDays: 0,
    severity: 0,
    quarantined: false,
  }));
}
