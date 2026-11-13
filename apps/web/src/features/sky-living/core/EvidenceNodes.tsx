import { measurement } from "../model/data";
import { angleToXY } from "./model";
import { useLocale } from "~/shared/i18n";
import { strings } from "./strings";
import "./tokens.css";

interface Node { id: string; angle: number; measurementRef: string; }

interface Props { nodes: Node[]; onSelect?: (ref: string) => void; }

export function EvidenceNodes({ nodes, onSelect }: Props) {
  const locale = useLocale();
  const t = strings[locale];
  const size = 240;
  const cx = size / 2, cy = size / 2, r = 96;
  return (
    <div className="sky-living-evidence" style={{ position: "relative", width: size, height: size }}>
      {nodes.map((n) => {
        const m = measurement(n.measurementRef);
        const pos = angleToXY(cx, cy, r, n.angle);
        const qColor = m?.quality === "limited" ? "#FFBF64" : m?.quality === "unknown" ? "#526B83" : "#72F3C4";
        return (
          <button
            key={n.id}
            onClick={() => onSelect?.(n.measurementRef)}
            style={{ position: "absolute", left: pos.x - 40, top: pos.y - 20, width: 80, background: "transparent", border: "none", color: "#E8F8FF", cursor: "pointer", textAlign: "center", fontSize: 11 }}
          >
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: qColor, marginRight: 4 }} />
            <div>{m?.label ?? n.measurementRef}</div>
            <div style={{ opacity: 0.8 }}>{m?.display ?? "—"}</div>
            <div style={{ fontSize: 9, opacity: 0.6 }}>{t.simulated}</div>
          </button>
        );
      })}
    </div>
  );
}