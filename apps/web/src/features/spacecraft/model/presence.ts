import type { Astronaut } from "~/features/astronaut";
import type { ClaimEntry } from "~/features/astronaut";

/** Who is currently checked in on `/spacecraft`, per crew member. */
export type CrewPresenceState = "mine" | "taken" | "free";

export interface CrewPresence {
  readonly astronaut: Astronaut;
  readonly state: CrewPresenceState;
}

/**
 * Map the crew roster onto the backend claim list (pure — no React, no IO):
 *
 * - `mine` — this browser session ({@link ClaimEntry.mine}) holds the crew member;
 * - `taken` — another live session holds them;
 * - `free` — nobody has claimed them.
 *
 * Crew order is preserved. Unknown claim ids (a crew member the backend knows and the bundled
 * fixture does not) are ignored, and an empty claim list marks everyone `free` — an unreachable
 * backend must not look like a checked-in crew. `mine` wins over a stale `taken` entry for the same
 * crew id.
 */
export function resolveCrewPresence(
  crew: readonly Astronaut[],
  claims: readonly ClaimEntry[],
): CrewPresence[] {
  const mineId = claims.find((claim) => claim.mine)?.astronautId;
  const takenIds = new Set(claims.filter((claim) => !claim.mine).map((claim) => claim.astronautId));
  return crew.map((astronaut) => ({
    astronaut,
    state: astronaut.id === mineId ? "mine" : takenIds.has(astronaut.id) ? "taken" : "free",
  }));
}

/** How many crew members are checked in (`mine` or `taken`). */
export function checkedInCount(presence: readonly CrewPresence[]): number {
  return presence.filter((entry) => entry.state !== "free").length;
}
