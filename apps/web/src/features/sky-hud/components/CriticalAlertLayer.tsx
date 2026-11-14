import { useLocale } from "~/shared/i18n";
import { STRINGS } from "./strings";

export interface CriticalAlertLayerProps {
  title?: string;
  message: string;
  onAcknowledge: () => void;
  onHandover: () => void;
  visible: boolean;
}

export function CriticalAlertLayer({ title, message, onAcknowledge, onHandover, visible }: CriticalAlertLayerProps) {
  const locale = useLocale();
  const s = STRINGS[locale];
  if (!visible) return null;
  return (
    <div role="alert" style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "rgba(8,27,48,0.95)", border: "1px solid #edb9ff", borderRadius: 8, padding: 16, color: "#ecf7ff", minWidth: 320 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title ?? s.criticalTitle}</div>
      <div style={{ marginBottom: 10 }}>{message}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onAcknowledge} style={{ padding: "6px 12px", background: "none", border: "1px solid #6cecff", color: "#6cecff", borderRadius: 6, cursor: "pointer" }}>{s.acknowledge}</button>
        <button type="button" onClick={onHandover} style={{ padding: "6px 12px", background: "none", border: "1px solid #edb9ff", color: "#edb9ff", borderRadius: 6, cursor: "pointer" }}>{s.handover}</button>
      </div>
    </div>
  );
}