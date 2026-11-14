// Watch Mode — minimal glanceable HUD for ≤480px screens (smartwatches, small phones).
// Fixture-driven like the staged HUD: every value comes from `vitals.ts` and stays labelled SIMULATED.
import "../watch-hud.css";
import { MIC_ARIA } from "../voiceCopy";
import { DETAILS, VITAL_VALUES } from "../vitals";
import { useCopy } from "../../../shared/i18n";
import type { VitalKind, VoicePhase } from "../types";

export interface WatchHudProps {
  readonly phase: VoicePhase;
  /** Voice-phase caption, already mapped from `phase` by the owner screen. */
  readonly hint: string;
  readonly micDisabled: boolean;
  /** First name of the claimed crew member, or null when none is picked. */
  readonly astronautName: string | null;
  readonly onToggleMic: () => void;
  readonly onSelectCrew: () => void;
  readonly onTypeInstead: () => void;
  readonly onVital: (kind: VitalKind) => void;
  readonly onHealth: () => void;
}

export function WatchHud({
  phase,
  hint,
  micDisabled,
  astronautName,
  onToggleMic,
  onSelectCrew,
  onTypeInstead,
  onVital,
  onHealth,
}: WatchHudProps) {
  const copy = useCopy();
  const w = copy.watch;
  // Status word derived from the fixture before its parenthetical ("Stable (demo)" → "Stable").
  const healthStatus = DETAILS.health.value.split("(")[0]?.trim() ?? DETAILS.health.value;
  const mission = DETAILS.mission.value; // Fixture: "ISS · Day 170" — English fixture, both locales.

  const tiles: ReadonlyArray<{ kind: VitalKind; label: string; aria: string; value: React.ReactNode }> = [
    {
      kind: "heartRate",
      label: w.vitalHeart,
      aria: "Heart rate, demo value 62 beats per minute",
      value: (
        <>
          {VITAL_VALUES.heartRate} <small>bpm</small>
        </>
      ),
    },
    {
      kind: "spo2",
      label: w.vitalSpo2,
      aria: "Oxygen saturation, demo value 98 percent",
      value: (
        <>
          {VITAL_VALUES.spo2} <small>%</small>
        </>
      ),
    },
    {
      kind: "respiration",
      label: w.vitalResp,
      aria: "Respiration, demo value 16 breaths per minute",
      value: (
        <>
          {VITAL_VALUES.respiration} <small>br/min</small>
        </>
      ),
    },
    {
      kind: "sleep",
      label: w.vitalSleep,
      aria: "Sleep, demo value seven hours and forty-two minutes",
      value: (
        <>
          {VITAL_VALUES.sleepHours} <small>h</small> {VITAL_VALUES.sleepMinutes} <small>m</small>
        </>
      ),
    },
  ];

  return (
    <section className="watch-hud" aria-label="SKY astronaut wellness, watch view">
      {/* Top strip: crew chip · SIMULATED tag · mission chip */}
      <header className="watch-top">
        <button
          type="button"
          className="watch-crew"
          onClick={onSelectCrew}
          aria-label={astronautName ? `${copy.astronaut.change}: ${astronautName}` : w.selectCrew}
        >
          <span className="watch-crew-dot" aria-hidden="true" />
          <span className="watch-crew-name">{astronautName ?? w.selectCrew}</span>
        </button>
        <span className="watch-tag">{w.simulated}</span>
        <span className="watch-mission">{mission}</span>
      </header>

      {/* Vitals glance grid — tap a tile for the shared detail dialog */}
      <div className="watch-vitals" role="group" aria-label="Sample physiological readings">
        {tiles.map((tile) => (
          <button
            key={tile.kind}
            type="button"
            className="watch-vital"
            aria-label={tile.aria}
            onClick={() => onVital(tile.kind)}
          >
            <span className="watch-vital-label">{tile.label}</span>
            <span className="watch-vital-value">{tile.value}</span>
          </button>
        ))}
      </div>

      {/* Wellness strip — fixture-derived, opens the shared health detail */}
      <button type="button" className="watch-wellness" onClick={onHealth} aria-label="View simulated overall health assessment">
        <span className="watch-wellness-label">{DETAILS.health.title}</span>
        <span className="watch-wellness-status">{healthStatus}</span>
      </button>

      {/* Voice action — same semantics as the desktop mic */}
      <div className="watch-voice">
        <button
          id="micButton"
          className="mic-button watch-mic"
          type="button"
          aria-label={MIC_ARIA[phase]}
          disabled={micDisabled}
          onClick={onToggleMic}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="8" width="12" height="24" rx="6" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M13 24c0 15 22 15 22 0M24 36v6m-7 0h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        </button>
        <p className="voice-hint watch-hint" aria-live="polite">{hint}</p>
        <button type="button" className="watch-type" onClick={onTypeInstead}>{w.typeInstead}</button>
      </div>

      {/* Footer — tiny disclaimer, always visible */}
      <footer className="watch-footer">
        AI-generated, not a substitute for a physician · {w.demonstrationOnly}
      </footer>
    </section>
  );
}
