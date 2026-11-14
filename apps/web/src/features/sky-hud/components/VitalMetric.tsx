import React from "react";
import { useLocale } from "~/shared/i18n";
import { STRINGS } from "./strings";
import { formatVital } from "../domain";
import type { VitalReading, VitalKind } from "../domain";

export interface VitalMetricProps {
  reading: VitalReading;
  onSelect?: (kind: VitalKind) => void;
}

const ICONS: Record<VitalKind, (color: string) => React.ReactNode> = {
  heartRate: (c) => (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M14 24s-9-6-9-13a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 13-9 13z" fill="none" stroke={c} strokeWidth="1.4" />
    </svg>
  ),
  respiration: (c) => (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M6 20 Q8 8 14 14 Q20 20 22 8" fill="none" stroke={c} strokeWidth="1.4" />
    </svg>
  ),
  spo2: (c) => (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <text x="14" y="19" textAnchor="middle" fontSize="11" fill={c} fontWeight="500">O₂</text>
    </svg>
  ),
  sleep: (c) => (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M20 6 A 10 10 0 1 0 20 22 A 7 7 0 1 1 20 6 Z" fill="none" stroke={c} strokeWidth="1.4" />
    </svg>
  ),
};

const COLORS: Record<VitalKind, string> = {
  heartRate: "#6cecff",
  respiration: "#bfadff",
  spo2: "#6cecff",
  sleep: "#bfadff",
};

export function VitalMetric({ reading, onSelect }: VitalMetricProps) {
  const locale = useLocale();
  const s = STRINGS[locale];
  const labels: Record<VitalKind, string> = {
    heartRate: s.heart,
    respiration: s.respiration,
    spo2: s.spo2,
    sleep: s.sleep,
  };
  const color = COLORS[reading.kind];
  return (
    <button
      type="button"
      onClick={() => onSelect?.(reading.kind)}
      aria-label={`${labels[reading.kind]} ${formatVital(reading)}`}
      style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", color: "#ecf7ff", padding: 6 }}
    >
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
        <g transform="translate(6,6)">{ICONS[reading.kind](color)}</g>
      </svg>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ fontSize: 11, color: "#a8bdd0", textTransform: "uppercase", letterSpacing: "0.1em" }}>{labels[reading.kind]}</span>
        <span style={{ fontSize: 22, fontWeight: 300 }}>{formatVital(reading)}</span>
      </span>
    </button>
  );
}