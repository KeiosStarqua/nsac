import { LivingCore } from "./LivingCore";
import { Filaments } from "./Filaments";
import { EvidenceNodes } from "./EvidenceNodes";
import type { UxState } from "../model/scene";

interface Node { id: string; angle: number; measurementRef: string; }

interface Props {
  state: UxState;
  density?: "micro" | "low" | "medium" | "high";
  points?: { id: string; angle: number; quality?: "good" | "limited" | "unknown" }[];
  nodes?: Node[];
  onSelect?: (ref: string) => void;
  className?: string;
}

export function CoreField({ state, density, points = [], nodes = [], onSelect, className }: Props) {
  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%", minHeight: 240 }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <Filaments points={points} />
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "40%", height: "40%" }}>
          <LivingCore state={state} density={density} />
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <EvidenceNodes nodes={nodes} onSelect={onSelect} />
      </div>
    </div>
  );
}