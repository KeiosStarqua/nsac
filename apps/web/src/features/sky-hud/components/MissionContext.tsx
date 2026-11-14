import { useEffect, useRef, useState } from "react";
import { useLocale } from "~/shared/i18n";
import { STRINGS } from "./strings";
import type { MissionContextData } from "../domain";

export interface MissionContextProps {
  mission?: MissionContextData;
  missionName?: string;
  missionDay?: number;
  missionTimeUTC?: string;
  isOnline?: boolean;
  latency?: number;
}

export function MissionContext(props: MissionContextProps) {
  const locale = useLocale();
  const s = STRINGS[locale];
  const mission = props.mission ?? {
    stationLabel: props.missionName ?? "ISS",
    missionDay: props.missionDay ?? 170,
    spacecraftTimeIso: props.missionTimeUTC,
    online: props.isOnline ?? true,
  };
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={s.projectedMission}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#ecf7ff", display: "flex", alignItems: "center", gap: 8 }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7" fill="none" stroke="#ecf7ff" strokeWidth="1" />
          <line x1="10" y1="3" x2="10" y2="17" stroke="#ecf7ff" strokeWidth="1" />
          <line x1="3" y1="10" x2="17" y2="10" stroke="#ecf7ff" strokeWidth="1" />
        </svg>
        <span style={{ fontSize: 16 }}>{mission.stationLabel} · {s.missionDay.replace("{day}", String(mission.missionDay))}</span>
      </button>
      <svg width="120" height="8" aria-hidden="true" style={{ display: "block" }}>
        <path d="M 0 4 Q 60 0 120 4" fill="none" stroke="#6cecff" strokeWidth="1" opacity="0.6" />
      </svg>
      {open && (
        <div role="dialog" aria-label={s.projectedMission} style={{ position: "absolute", right: 0, top: "100%", marginTop: 6, padding: 12, background: "rgba(8,27,48,0.9)", border: "1px solid rgba(142,220,255,0.24)", borderRadius: 8, minWidth: 180, color: "#ecf7ff", fontSize: 13, zIndex: 50 }}>
          <div>{s.day}: {mission.missionDay}</div>
          <div>{s.time}: {mission.spacecraftTimeIso ?? "—"}</div>
          <div>{mission.online ? s.online : s.offline}</div>
        </div>
      )}
    </div>
  );
}