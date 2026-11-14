"use client";

import { useEffect, useState } from "react";
import { ASTRONAUTS, getOrCreateSessionId, listClaims } from "~/features/astronaut";
import type { ClaimEntry } from "~/features/astronaut";
import { AvatarGroup } from "~/shared/beui/avatar-group";
import {
  checkedInCount,
  resolveCrewPresence,
  type CrewPresenceState,
} from "../model/presence";

// The one piece of chrome on `/spacecraft` (product decision 2026-11-15): who is checked in.
// Fictional crew only, rendered as initials — there are no photos, and nothing here is measured.

// `mine` carries a solid cyan ring, `taken` a faint one, `free` recedes.
const STATE_CLASS: Record<CrewPresenceState, string> = {
  mine: "opacity-100 [box-shadow:0_0_0_2px_#5EEAD4]",
  taken: "opacity-100 [box-shadow:0_0_0_1.5px_rgba(94,234,212,0.35)]",
  free: "opacity-35 grayscale",
};

const STATE_HINT: Record<CrewPresenceState, string> = {
  mine: "You (in session)",
  taken: "In session",
  free: "Not checked in",
};

const CAPTION =
  "m-0 font-(family-name:--mono) text-[10px] tracking-[0.22em] uppercase text-(--muted)/85 select-none";

/**
 * Crew presence overlay: the avatars of the crew and which of them are checked in, read from the
 * same backend claims the HUD picker uses. A claim is a session holding a crew member for the demo;
 * every member is rendered (initials), not only the checked-in ones, so "nobody yet" stays legible.
 *
 * The backend may be down (`reachable: false`) — the group still renders, and the caption says the
 * status is unavailable instead of pretending the crew is absent.
 */
export function CrewPresence() {
  const [claims, setClaims] = useState<ClaimEntry[]>([]);
  // `null` until the first answer: the count is not shown before it is known.
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const sessionId = getOrCreateSessionId();
    void listClaims({ data: { sessionId } })
      .then((res) => {
        if (!alive) return;
        setClaims(Array.isArray(res?.claims) ? res.claims : []);
        setReachable(res?.reachable !== false);
      })
      .catch(() => {
        if (alive) setReachable(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const presence = resolveCrewPresence(ASTRONAUTS, claims);
  const checkedIn = checkedInCount(presence);
  const members = presence.map(({ astronaut, state }) => ({
    id: astronaut.id,
    name: astronaut.name,
    hint: `${astronaut.name} · ${astronaut.role} — ${STATE_HINT[state]}`,
    className: STATE_CLASS[state],
  }));

  return (
    <div className="pointer-events-auto absolute left-5 bottom-5 z-10 flex flex-col gap-2">
      <p className={CAPTION}>
        {reachable === null
          ? "CREW ON STATION"
          : reachable
            ? `CREW ON STATION · ${checkedIn}/${presence.length}`
            : "CREW ON STATION · STATUS UNAVAILABLE"}
      </p>
      <AvatarGroup members={members} max={6} size="md" label="Crew on station" />
    </div>
  );
}
