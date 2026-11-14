import { useState } from "react";
import { useLocale } from "~/shared/i18n";
import { STRINGS } from "./strings";
import type { HealthAssessment, VitalVisualState } from "../domain";

export interface HealthProjectionProps {
  health?: HealthAssessment;
  onOpenHealthSummary?: () => void;
}

const REGION_LABELS: Record<string, keyof typeof STRINGS.en> = {
  head: "head",
  chest: "chest",
  arm: "arms",
  leg: "legs",
};

function HumanHologram({ regions, onSelect }: { regions: Array<{ id: string; state: VitalVisualState }>; onSelect: (id: string) => void }) {
  const locale = useLocale();
  const s = STRINGS[locale];
  return (
    <svg width="120" height="220" viewBox="0 0 120 220" role="img" aria-label="Human hologram">
      <defs>
        <linearGradient id="holo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6cecff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#bfadff" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* head */}
      <circle cx="60" cy="28" r="16" fill="none" stroke="url(#holo)" strokeWidth="1.5" />
      <button type="button" onClick={() => onSelect("head")} aria-label={s.head} style={{ position: "absolute" }} />
      {/* torso */}
      <rect x="44" y="48" width="32" height="70" rx="10" fill="rgba(108,236,255,0.08)" stroke="url(#holo)" strokeWidth="1.5" />
      {/* arms */}
      <line x1="44" y1="58" x2="24" y2="110" stroke="url(#holo)" strokeWidth="1.5" />
      <line x1="76" y1="58" x2="96" y2="110" stroke="url(#holo)" strokeWidth="1.5" />
      {/* legs */}
      <line x1="52" y1="118" x2="44" y2="200" stroke="url(#holo)" strokeWidth="1.5" />
      <line x1="68" y1="118" x2="76" y2="200" stroke="url(#holo)" strokeWidth="1.5" />
      {/* warm focal spot */}
      <circle cx="60" cy="75" r="8" fill="rgba(237,185,255,0.35)" />
    </svg>
  );
}

export function HealthProjection({ health, onOpenHealthSummary }: HealthProjectionProps) {
  const locale = useLocale();
  const s = STRINGS[locale];
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const regions = health?.bodyRegions ?? [];
  const stateLabel =
    health?.state === "stable" ? s.stable :
    health?.state === "attention" ? "Attention" :
    health?.state === "critical" ? "Critical" : "Unknown";
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <HumanHologram regions={regions} onSelect={setSelectedRegion} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#a8bdd0", textTransform: "uppercase", letterSpacing: "0.15em" }}>{s.overall}</span>
          <span style={{ fontSize: 34, fontWeight: 300, color: "#55e7b9" }}>{stateLabel}</span>
          <span style={{ fontSize: 13, color: "#a8bdd0" }}>{s.maintain}</span>
          <span style={{ fontSize: 13, color: "#a8bdd0" }}>{s.readiness}</span>
          <span style={{ fontSize: 11, color: "#a8bdd0", marginTop: 6 }}>{s.fixtureAssessment}</span>
          <button type="button" onClick={onOpenHealthSummary} style={{ marginTop: 8, background: "none", border: "none", color: "#6cecff", cursor: "pointer", fontSize: 12, textAlign: "left" }}>
            {s.regionDetails}
          </button>
        </div>
      </div>
      {selectedRegion && (
        <div role="dialog" aria-label={s.regionDetails} style={{ position: "absolute", top: 0, right: 0, padding: 10, background: "rgba(8,27,48,0.9)", border: "1px solid rgba(142,220,255,0.24)", borderRadius: 8, fontSize: 12, color: "#ecf7ff", zIndex: 10 }}>
          <div>{REGION_LABELS[selectedRegion] ? (s as any)[REGION_LABELS[selectedRegion]] : selectedRegion}</div>
          <div style={{ color: "#a8bdd0" }}>{regions.find((r) => r.id === selectedRegion)?.state ?? "—"}</div>
          <button type="button" onClick={() => setSelectedRegion(null)} aria-label={STRINGS[locale].close} style={{ background: "none", border: "none", color: "#a8bdd0", cursor: "pointer" }}>×</button>
        </div>
      )}
    </div>
  );
}