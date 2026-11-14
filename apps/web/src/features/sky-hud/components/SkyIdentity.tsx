import { useLocale } from "~/shared/i18n";
import { STRINGS } from "./strings";

export interface SkyIdentityProps {
  subtitle?: string;
  connectionState?: "online" | "offline";
  onOverview?: () => void;
}

export function SkyIdentity({ subtitle, connectionState = "online", onOverview }: SkyIdentityProps) {
  const locale = useLocale();
  const s = STRINGS[locale];
  const sub = subtitle ?? s.skySubtitle;
  const disconnected = connectionState === "offline";
  return (
    <button
      type="button"
      onClick={onOverview}
      aria-label="SKY overview"
      className="sky-identity"
      style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", color: "inherit" }}
    >
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <defs>
          <linearGradient id="sky-crescent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4bb8ff" />
            <stop offset="50%" stopColor="#6cecff" />
            <stop offset="100%" stopColor="#bfadff" />
          </linearGradient>
        </defs>
        <path d="M 22 5 A 13 13 0 1 0 22 25 A 9 9 0 1 1 22 5 Z" fill="url(#sky-crescent)" />
      </svg>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ letterSpacing: "0.35em", fontSize: 24, fontWeight: 300, color: "#ecf7ff" }}>S K Y</span>
        <span style={{ fontSize: 12, color: "#a8bdd0" }}>{sub}</span>
      </span>
      {disconnected && <span style={{ fontSize: 11, color: "#edb9ff", marginLeft: 6 }}>{s.disconnected}</span>}
    </button>
  );
}