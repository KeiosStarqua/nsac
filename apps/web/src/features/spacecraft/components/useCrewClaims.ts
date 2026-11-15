"use client";

import { useSyncExternalStore } from "react";
import { getOrCreateSessionId, listClaims } from "~/features/astronaut";
import type { ClaimEntry } from "~/features/astronaut";

/** The backend claims of this browser session, as `/spacecraft` reads them. */
export interface CrewClaimsSnapshot {
  readonly claims: readonly ClaimEntry[];
  /** `null` until the first answer; `false` when the backend could not be reached. */
  readonly reachable: boolean | null;
}

// One shared snapshot per mounted page: the crew overlay and the 3D position markers read the same
// answer, so the avatars and the markers can never disagree, and the claims route is called once.
// Nothing is cached across navigations — when the last consumer unmounts the snapshot is dropped.
const INITIAL: CrewClaimsSnapshot = { claims: [], reachable: null };

let snapshot: CrewClaimsSnapshot = INITIAL;
let opened = false;
let generation = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function open(): void {
  if (opened) return;
  opened = true;
  const request = generation;
  const sessionId = getOrCreateSessionId();
  void listClaims({ data: { sessionId } })
    .then((res) => {
      if (request !== generation) return;
      const claims = res?.claims;
      snapshot = {
        claims: Array.isArray(claims) ? claims : [],
        reachable: res?.reachable !== false,
      };
      emit();
    })
    .catch(() => {
      if (request !== generation) return;
      snapshot = { claims: [], reachable: false };
      emit();
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  open();
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    // No consumer left: invalidate the in-flight read and start clean on the next mount.
    generation += 1;
    opened = false;
    snapshot = INITIAL;
  };
}

/**
 * Backend claims for this session, read once on mount (the same call `CrewPresence` always made).
 * An unreachable backend is not an error: `reachable` goes `false` and the crew reads as `free`.
 */
export function useCrewClaims(): CrewClaimsSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => INITIAL,
  );
}
