// The facts the HUD renders. Pure: no React, no IO. Every digit the HUD shows comes from the
// fixture modules through this builder; programs never write one.
import { DETAILS, VITAL_VALUES } from "~/features/sky-hud/vitals";
import type { HudFactId } from "./names";

export interface HudFactSegment {
  readonly value: number | string;
  readonly unit?: string;
}

export interface HudFact {
  readonly id: HudFactId;
  /** One entry per value/unit group. `sleep` renders "7 h" and "42 m". */
  readonly segments: ReadonlyArray<HudFactSegment>;
  /** Accessible demo label. Digits are fixture values, never program text. */
  readonly aria: string;
}

export type HudFacts = Readonly<Record<HudFactId, HudFact>>;

/** Builds the facts object the HUD scope provides. Cheap and deterministic; memoise at the call site. */
export function buildHudFacts(): HudFacts {
  return {
    heartRate: {
      id: "heartRate",
      segments: [{ value: VITAL_VALUES.heartRate, unit: "bpm" }],
      aria: `Heart rate, demo value ${VITAL_VALUES.heartRate} beats per minute`,
    },
    respiration: {
      id: "respiration",
      segments: [{ value: VITAL_VALUES.respiration, unit: "br/min" }],
      aria: `Respiration, demo value ${VITAL_VALUES.respiration} breaths per minute`,
    },
    spo2: {
      id: "spo2",
      segments: [{ value: VITAL_VALUES.spo2, unit: "%" }],
      aria: `Oxygen saturation, demo value ${VITAL_VALUES.spo2} percent`,
    },
    sleep: {
      id: "sleep",
      segments: [
        { value: VITAL_VALUES.sleepHours, unit: "h" },
        { value: VITAL_VALUES.sleepMinutes, unit: "m" },
      ],
      aria: "Sleep, demo value seven hours and forty-two minutes",
    },
    missionDay: {
      id: "missionDay",
      segments: [{ value: DETAILS.mission.value }],
      aria: `Mission context, demo mission ${DETAILS.mission.value}`,
    },
  };
}
