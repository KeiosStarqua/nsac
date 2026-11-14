import type { VitalReading, VitalKind } from "../domain";
import { VitalMetric } from "./VitalMetric";

export interface VitalsProjectionProps {
  vitals: Record<VitalKind, VitalReading>;
  onSelect?: (kind: VitalKind) => void;
}

export function VitalsProjection({ vitals, onSelect }: VitalsProjectionProps) {
  const kinds: VitalKind[] = ["heartRate", "respiration", "spo2", "sleep"];
  return (
    <div className="vitals-projection" style={{ position: "relative" }}>
      <svg aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", width: "100%", height: "100%" }} viewBox="0 0 290 305">
        <ellipse cx="145" cy="152" rx="120" ry="140" fill="none" stroke="rgba(142,220,255,0.12)" strokeWidth="1" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative", zIndex: 1 }}>
        {kinds.map((k) => (
          <VitalMetric key={k} reading={vitals[k]} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}