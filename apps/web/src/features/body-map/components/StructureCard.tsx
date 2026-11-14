import React from "react";
import { getStructure } from "open-anatomy-3d";
import { VITAL_VALUES } from "../../sky-hud/vitals";

interface Props { selected: string | null; onClose: () => void; onReset: () => void; }

export default function StructureCard({ selected, onClose, onReset }: Props) {
  if (!selected) return null;
  const s = getStructure(selected);
  const label = s?.label ?? selected;
  const system = s?.system ?? "unknown";
  const category = s?.category ?? "—";
  const color = s?.color ?? "#88ccff";
  let vitalsLine = "Catalog structure. Simulated data.";
  if (selected.toLowerCase().includes("heart")) {
    vitalsLine = `Heart rate ${VITAL_VALUES.heartRate} bpm. Simulated data.`;
  } else if (selected.toLowerCase().includes("lung")) {
    vitalsLine = `Respiration ${VITAL_VALUES.respiration} br/min, SpO₂ ${VITAL_VALUES.spo2} %. Simulated data.`;
  } else if (selected.toLowerCase().includes("brain")) {
    vitalsLine = `Sleep ${VITAL_VALUES.sleepHours} h ${VITAL_VALUES.sleepMinutes} m. Simulated data.`;
  }
  return (
    <aside style={{ position: "absolute", right: 12, top: 12, width: 260, background: "rgba(0,0,0,0.7)", color: "#cfe", padding: 12, borderRadius: 8 }}>
      <button type="button" onClick={onClose} aria-label="Close card">Close</button>
      <h3>{label}</h3>
      <p>System: {system}</p>
      <p>Category: {category}</p>
      <span style={{ display: "inline-block", width: 16, height: 16, background: color }} aria-label="colour swatch" />
      <p>{vitalsLine}</p>
      <button type="button" onClick={onReset}>Reset view</button>
    </aside>
  );
}