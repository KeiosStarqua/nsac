// The SKY state machine (UX.md §4): presence, listening, processing, attention, understanding,
// decision, continuity, connection, emergency. Priority arbitration prefers higher priority (P0 beats
// P5); only validated rules reach P0/P1, and no intent may downgrade them.

import type { Intent, Priority, UxState } from "./scene";

export interface Arbiter {
  /** True when a state may be exited by a lower-priority ask (emergency cannot, P1 needs ack). */
  exits: Readonly<Record<UxState, boolean>>;
  /** Winner of a contest between the current state and a candidate. */
  resolve(current: UxState, candidate: UxState, candidatePriority: Priority): UxState;
}

const PRIORITY_ORDER: readonly Priority[] = ["P0", "P1", "P2", "P3", "P4", "P5"];
export function priorityRank(p: Priority): number {
  return PRIORITY_ORDER.indexOf(p);
}
const STATE_PRIORITY: Record<UxState, Priority> = {
  emergency: "P0",
  attention: "P2",
  continuity: "P3",
  connection: "P4",
  understanding: "P3",
  decision: "P3",
  listening: "P4",
  processing: "P4",
  presence: "P5",
};
export function statePriority(state: UxState): Priority {
  return STATE_PRIORITY[state];
}

/** Emergency and unresolved P1-ish attention override anything. Otherwise the newest event wins,
 *  but never escalates a weak signal over a strong one. */
export function resolveState(current: UxState, candidate: UxState): UxState {
  if (current === "emergency") return "emergency";
  if (candidate === "emergency") return "emergency";
  const now = priorityRank(statePriority(current));
  const next = priorityRank(statePriority(candidate));
  // A lower rank index = higher priority. Stay with the stronger one.
  return next <= now ? candidate : current;
}

export type SkyEvent =
  | { readonly type: "user-ask"; readonly intent: Intent }
  | { readonly type: "deviancy-detected" }
  | { readonly type: "answer-ready" }
  | { readonly type: "approved" }
  | { readonly type: "deferred" }
  | { readonly type: "rejected" }
  | { readonly type: "exercise-complete" }
  | { readonly type: "emergency" }
  | { readonly type: "emergency-cleared" }
  | { readonly type: "queue-roundtrip" }
  | { readonly type: "dismiss" }
  | { readonly type: "timeout" };

export interface SkyStateSnapshot {
  readonly state: UxState;
  readonly since: number;
  readonly lastIntent: Intent | null;
}

export function transition(snapshot: SkyStateSnapshot, event: SkyEvent): SkyStateSnapshot {
  const { state, since, lastIntent } = snapshot;
  const stamp = { state, since, lastIntent };
  const move = (next: UxState, intent: Intent | null = lastIntent): SkyStateSnapshot =>
    ({ state: resolveState(state, next), since: Date.now(), lastIntent: intent });

  switch (event.type) {
    case "emergency":
      return { state: "emergency", since: Date.now(), lastIntent: "emergency" };
    case "emergency-cleared":
      return { state: "presence", since: Date.now(), lastIntent: null };
    case "user-ask":
      if (event.intent === "emergency") return { state: "emergency", since: Date.now(), lastIntent: "emergency" };
      if (state === "emergency") return stamp;
      return move("processing", event.intent);
    case "deviancy-detected":
      if (state === "emergency") return stamp;
      return move("attention", lastIntent);
    case "answer-ready":
      if (state === "processing") return move("understanding", lastIntent);
      return stamp;
    case "approved":
      if (state === "decision" || state === "understanding") return move("continuity", lastIntent);
      return stamp;
    case "deferred":
    case "rejected":
      if (state === "decision" || state === "understanding") return move("presence", null);
      if (state === "attention") return move("presence", null);
      return stamp;
    case "exercise-complete":
      return state === "continuity" ? { state: "presence", since: Date.now(), lastIntent: null } : stamp;
    case "queue-roundtrip":
      return state === "continuity" || state === "attention" ? move("connection", lastIntent) : stamp;
    case "dismiss":
      if (state === "attention" || state === "understanding" || state === "decision") return move("presence", null);
      return stamp;
    case "timeout":
      if (state === "processing" || state === "listening") return move("presence", lastIntent);
      return stamp;
  }
}

export const initialSnapshot: SkyStateSnapshot = { state: "presence", since: Date.now(), lastIntent: null };
