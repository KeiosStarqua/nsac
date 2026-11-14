import { z } from "zod";

export interface Astronaut {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly initial: string;
  readonly callsign: string;
}

// Fictional astronauts only (no real people, no photos). The ids mirror the backend
// `/api/astronauts` rows so a stored selection resolves against either source.
export const ASTRONAUTS: readonly Astronaut[] = [
  { id: "ayla-reyes", name: "Ayla Reyes", role: "Commander", initial: "AR", callsign: "CDR-01" },
  { id: "dae-jung-park", name: "Dae-Jung Park", role: "Flight Engineer", initial: "DP", callsign: "FE-02" },
  { id: "lena-fischer", name: "Lena Fischer", role: "Medical Officer", initial: "LF", callsign: "MO-03" },
  { id: "tomas-ortega", name: "Tomas Ortega", role: "Flight Engineer", initial: "TO", callsign: "FE-04" },
  { id: "yuki-tanaka", name: "Yuki Tanaka", role: "Mission Specialist", initial: "YT", callsign: "MS-05" },
  { id: "noor-abbasi", name: "Noor Abbasi", role: "Payload Specialist", initial: "NA", callsign: "PA-06" },
];

/** Ayla Reyes is the reference selection for the showcase fixture (DESIGN.md). */
export const DEFAULT_ASTRONAUT_ID = ASTRONAUTS[0]!.id;

export const ASTRONAUT_STORAGE_KEY = "nsac.astronaut";

/** Ids written by the first three-crew picker, before the ids matched the backend rows. */
const LEGACY_IDS: Readonly<Record<string, string>> = {
  ayla: "ayla-reyes",
  dae: "dae-jung-park",
  lena: "lena-fischer",
};

/** Map a stored/legacy id onto the canonical id, or `null` for an empty value. */
export function normalizeAstronautId(id: string | null | undefined): string | null {
  const trimmed = id?.trim();
  if (!trimmed) return null;
  return LEGACY_IDS[trimmed] ?? trimmed;
}

export function findAstronaut(
  id: string | null | undefined,
  roster: readonly Astronaut[] = ASTRONAUTS,
): Astronaut | null {
  const normalized = normalizeAstronautId(id);
  if (!normalized) return null;
  return roster.find((a) => a.id === normalized) ?? null;
}

/** The roster entry for a `1`…`9` key press, or `null` for any other key. */
export function astronautForKey(key: string, roster: readonly Astronaut[] = ASTRONAUTS): Astronaut | null {
  if (!/^[1-9]$/.test(key)) return null;
  return roster[Number(key) - 1] ?? null;
}

/** Move the selection by `delta` cards, wrapping at both ends. */
export function moveSelection(
  roster: readonly Astronaut[],
  currentId: string | null,
  delta: number,
): Astronaut | null {
  if (roster.length === 0) return null;
  const index = Math.max(
    0,
    roster.findIndex((a) => a.id === normalizeAstronautId(currentId)),
  );
  const next = (((index + delta) % roster.length) + roster.length) % roster.length;
  return roster[next] ?? null;
}

/**
 * Like {@link moveSelection}, but cards whose id is in `takenIds` are skipped: keyboard
 * navigation never lands on a crew member claimed by another session. Returns the card `|delta|`
 * available-steps away, wrapping at both ends; `null` only when every card is taken.
 */
export function moveSelectionAvailable(
  roster: readonly Astronaut[],
  takenIds: ReadonlySet<string>,
  currentId: string | null,
  delta: number,
): Astronaut | null {
  const len = roster.length;
  if (len === 0) return null;
  const hasAvailable = roster.some((a) => !takenIds.has(a.id));
  if (!hasAvailable) return null;
  const step = delta >= 0 ? 1 : -1;
  let index = Math.max(
    0,
    roster.findIndex((a) => a.id === normalizeAstronautId(currentId)),
  );
  let moves = Math.abs(Math.trunc(delta)) || 1;
  let guard = len * (moves + 1) + len;
  while (moves > 0 && guard > 0) {
    guard -= 1;
    index = (index + step + len) % len;
    if (takenIds.has(roster[index]!.id)) continue;
    moves -= 1;
  }
  return roster[index]!;
}

/** Greeting name: the first word of a full name ("Ayla Reyes" → "Ayla"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "Dae-Jung Park" → "DP", "Yuki Tanaka" → "YT". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

const AstronautRowSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  roleCode: z.string().trim().min(1),
  callsign: z.string().nullish(),
  bio: z.string().nullish(),
});

export type AstronautRow = z.input<typeof AstronautRowSchema>;

/** Backend row → picker card. `roleCode` is the displayed call sign, `bio` carries the role. */
export function astronautFromRow(row: AstronautRow): Astronaut {
  const role = row.bio?.trim();
  return {
    id: row.id,
    name: row.name,
    role: role && role.length > 0 ? role : row.roleCode,
    initial: initials(row.name),
    callsign: row.roleCode,
  };
}

/**
 * Validate backend rows leniently: malformed rows are dropped, duplicate ids keep the first,
 * and an empty or non-array payload yields `[]` so the caller can fall back to `ASTRONAUTS`.
 */
export function parseAstronautRows(input: unknown): Astronaut[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: Astronaut[] = [];
  for (const item of input) {
    const parsed = AstronautRowSchema.safeParse(item);
    if (!parsed.success) continue;
    const astronaut = astronautFromRow(parsed.data);
    if (seen.has(astronaut.id)) continue;
    seen.add(astronaut.id);
    out.push(astronaut);
  }
  return out;
}
