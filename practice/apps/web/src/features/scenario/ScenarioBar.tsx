import { useState } from "react";
import { HORIZON } from "~/shared/scenario/search";
import { useScenario } from "./use-scenario";

function describe(token: string): string {
  const [day, type, who] = token.split(":");
  const label =
    type === "masks"
      ? "masks on"
      : type === "ventilation"
        ? "air scrubbers high"
        : type === "quarantine"
          ? `isolate ${who}`
          : `release ${who}`;
  return `Day ${day} · ${label}`;
}

export function ScenarioBar() {
  const { day, seed, iv, setDay, setSeed, undoLast, clearActions } = useScenario();
  const [seedDraft, setSeedDraft] = useState(String(seed));

  const commitSeed = () => {
    const n = Number(seedDraft);
    if (Number.isInteger(n) && n >= 1 && n <= 9999 && n !== seed) setSeed(n);
    else setSeedDraft(String(seed));
  };

  return (
    <section className="bar" aria-label="Scenario controls">
      <label className="bar-day">
        <span>Mission day {day}</span>
        <input
          type="range"
          min={0}
          max={HORIZON}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
        />
      </label>
      <div className="bar-buttons">
        <button type="button" onClick={() => setDay(day + 1)} disabled={day >= HORIZON}>
          +1 day
        </button>
        <button type="button" onClick={() => setDay(day + 3)} disabled={day >= HORIZON}>
          Fast-forward 3
        </button>
      </div>
      <label className="bar-seed">
        <span>Story #</span>
        <input
          inputMode="numeric"
          value={seedDraft}
          onChange={(e) => setSeedDraft(e.target.value)}
          onBlur={commitSeed}
          onKeyDown={(e) => e.key === "Enter" && commitSeed()}
        />
      </label>
      <div className="bar-actions" aria-label="Confirmed actions">
        {iv.length === 0 ? (
          <span className="muted">No actions confirmed yet</span>
        ) : (
          iv.map((t) => (
            <span key={t} className="chip">
              {describe(t)}
            </span>
          ))
        )}
        {iv.length > 0 ? (
          <>
            <button type="button" className="link" onClick={undoLast}>
              Undo last
            </button>
            <button type="button" className="link" onClick={clearActions}>
              Clear
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
