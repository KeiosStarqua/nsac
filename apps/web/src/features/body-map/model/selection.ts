// What the structure card shows for a selected key. Every reading comes from the
// Sky fixture (`VITAL_VALUES`); no number is ever typed into prose here.
import { SYSTEM_LABELS, getStructure, type AnatomySystem } from "open-anatomy-3d";
import { VITAL_VALUES } from "../../sky-hud/vitals";

export interface VitalRow {
  readonly label: string;
  readonly value: string;
}

export interface StructureDetails {
  readonly key: string;
  readonly label: string;
  /** Null when the picked mesh is not in the catalog. */
  readonly system: AnatomySystem | null;
  readonly systemLabel: string;
  readonly category: string;
  readonly color: string;
  readonly vitals: VitalRow[];
  readonly known: boolean;
}

const UNKNOWN_COLOR = "#8fd8ff";

// Catalog keys that have a simulated reading in the HUD. Keyed by structure key,
// so the card never guesses from the label text.
const VITALS_BY_KEY: Readonly<Record<string, VitalRow[]>> = {
  heart: [{ label: "Heart rate", value: `${VITAL_VALUES.heartRate} bpm` }],
  lung_l: [
    { label: "Respiration", value: `${VITAL_VALUES.respiration} br/min` },
    { label: "Oxygen saturation", value: `${VITAL_VALUES.spo2} %` },
  ],
  lung_r: [
    { label: "Respiration", value: `${VITAL_VALUES.respiration} br/min` },
    { label: "Oxygen saturation", value: `${VITAL_VALUES.spo2} %` },
  ],
  brain: [
    {
      label: "Sleep duration",
      value: `${VITAL_VALUES.sleepHours} h ${VITAL_VALUES.sleepMinutes} m`,
    },
  ],
};

function humanize(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function structureDetails(key: string): StructureDetails {
  const structure = getStructure(key);
  return {
    key,
    label: structure?.label ?? humanize(key),
    system: structure?.system ?? null,
    systemLabel: structure ? SYSTEM_LABELS[structure.system] : "Not in the catalog",
    category: structure?.category ?? "—",
    color: structure?.color ?? UNKNOWN_COLOR,
    vitals: VITALS_BY_KEY[key] ?? [],
    known: Boolean(structure),
  };
}
