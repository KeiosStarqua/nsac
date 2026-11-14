// Fixture telemetry & detail copy — every value here is the design-reference fixture, not a live sensor.
// Anything shown originates from this file and is labelled "Simulated data" in the UI.
import type { VitalKind } from "../sky-hud/types";

export interface VitalDetail {
  readonly title: string;
  readonly value: string;
  readonly message: string;
  readonly eyebrow: string;
  readonly footer?: string;
}

export const VITAL_DETAILS: Record<VitalKind, VitalDetail> = {
  heartRate: {
    title: "Heart rate",
    value: "62 bpm",
    message: "Illustrative resting heart-rate reading. Source: screenshot fixture. No live sensor is connected.",
    eyebrow: "SIMULATED SENSOR",
  },
  respiration: {
    title: "Respiration",
    value: "16 br/min",
    message: "Illustrative breathing-rate reading. Connect a validated sensor for live monitoring.",
    eyebrow: "SIMULATED SENSOR",
  },
  spo2: {
    title: "Oxygen saturation",
    value: "98 %",
    message: "Illustrative SpO₂ reading from the design reference. This is not an actual oxygen measurement.",
    eyebrow: "SIMULATED SENSOR",
  },
  sleep: {
    title: "Sleep duration",
    value: "7 h 42 m",
    message: "Illustrative sleep-duration summary. No sleep tracking service is connected.",
    eyebrow: "SIMULATED SENSOR",
  },
};

export interface DetailDialog {
  readonly title: string;
  readonly value?: string;
  readonly message: string;
  readonly eyebrow?: string;
  readonly footer?: string;
}

export const DETAILS = {
  health: {
    title: "Overall wellness",
    value: "Stable (demo)",
    message: "This status reproduces the reference artwork. It is not a clinical finding and is not computed from these four sample metrics.",
    eyebrow: "REFERENCE SCREEN FIXTURE",
  },
  hologram: {
    title: "Body hologram",
    value: "Illustrative scan",
    message: "The anatomical figure is a decorative projection. No body-region diagnosis or sensor map is connected.",
    eyebrow: "VISUAL MODEL",
  },
  mission: {
    title: "Mission context",
    value: "ISS · Day 170",
    message: "The mission identifier and day are copied from the concept design. No actual ISS tracking, spacecraft connection or time synchronization is available.",
    eyebrow: "REFERENCE MISSION",
  },
} as const;

export const FIXTURE_LABEL = "SIMULATED TELEMETRY";
