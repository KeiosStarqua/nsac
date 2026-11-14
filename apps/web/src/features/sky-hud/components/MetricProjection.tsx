import { useEffect } from "react";
import { useLocale } from "~/shared/i18n";
import { STRINGS } from "./strings";
import { FIXTURE_LABEL } from "../domain";
import type { VitalReading } from "../domain";
import { formatVital } from "../domain";

export interface MetricProjectionProps {
  reading?: VitalReading | null;
  open: boolean;
  onClose: () => void;
}

export function MetricProjection({ reading, open, onClose }: MetricProjectionProps) {
  const locale = useLocale();
  const s = STRINGS[locale];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || !reading) return null;
  return (
    <div role="dialog" aria-label={s.projectedMission} style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "rgba(8,27,48,0.92)", border: "1px solid rgba(142,220,255,0.24)", borderRadius: 12, padding: 20, minWidth: 260, color: "#ecf7ff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong>{s.source}</strong>
          <button type="button" onClick={onClose} aria-label={s.close} style={{ background: "none", border: "none", color: "#a8bdd0", cursor: "pointer" }}>×</button>
        </div>
        <div>{s.source}: {reading.source}</div>
        <div>{s.timestamp}: {reading.timestamp ?? "—"}</div>
        <div>{s.quality}: {reading.quality}</div>
        <div>{s.trend}: {reading.trend ?? "—"}</div>
        <div>{formatVital(reading)}</div>
        <div style={{ marginTop: 8, fontSize: 11, color: "#a8bdd0" }}>{FIXTURE_LABEL}</div>
      </div>
    </div>
  );
}