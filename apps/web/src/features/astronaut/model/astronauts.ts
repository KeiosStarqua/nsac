export interface Astronaut {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly initial: string;
  readonly callsign: string;
}

// Fictional astronauts only (no real people, no photos).
export const ASTRONAUTS: readonly Astronaut[] = [
  { id: "ayla", name: "Ayla Reyes", role: "Commander", initial: "AR", callsign: "CDR-01" },
  { id: "dae", name: "Dae-Jung Park", role: "Flight Engineer", initial: "DP", callsign: "FE-02" },
  { id: "lena", name: "Lena Fischer", role: "Medical Officer", initial: "LF", callsign: "MO-03" },
];

export const ASTRONAUT_STORAGE_KEY = "nsac.astronaut";

export function findAstronaut(id: string | null): Astronaut | null {
  if (!id) return null;
  return ASTRONAUTS.find((a) => a.id === id) ?? null;
}