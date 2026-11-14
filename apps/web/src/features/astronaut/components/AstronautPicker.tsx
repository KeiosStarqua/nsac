import { useEffect, useState } from "react";
import { ASTRONAUTS } from "../model/astronauts";
import styles from "./AstronautPicker.module.css";

interface Props {
  readonly open: boolean;
  readonly onSelect: (id: string) => void;
}

export function AstronautPicker({ open, onSelect }: Props) {
  const [selected, setSelected] = useState<string>(ASTRONAUTS[0]!.id);
  useEffect(() => {
    if (open) setSelected(ASTRONAUTS[0]!.id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") setSelected(ASTRONAUTS[0]!.id);
      if (e.key === "2") setSelected(ASTRONAUTS[1]!.id);
      if (e.key === "3") setSelected(ASTRONAUTS[2]!.id);
      if (e.key === "Enter") {
        onSelect(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, onSelect]);

  if (!open) return null;
  const chosen = ASTRONAUTS.find((a) => a.id === selected) ?? ASTRONAUTS[0]!;
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="astronaut-picker-title">
      <section className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.pill}>CREW ROSTER</span>
          <h2 id="astronaut-picker-title" className={styles.title}>Select your astronaut</h2>
          <p className={styles.subtitle}>Choose the crew member this console will follow.</p>
        </div>
        <div className={styles.grid}>
          {ASTRONAUTS.map((a, i) => {
            const isSelected = selected === a.id;
            return (
              <button
                key={a.id}
                type="button"
                className={styles.card + (isSelected ? " " + styles.cardSelected : " " + styles.cardDim)}
                onClick={() => setSelected(a.id)}
              >
                <div className={styles.callsignRow}>
                  <span className={styles.callsign}>{a.callsign}</span>
                  <span className={styles.index}>#{i + 1}</span>
                </div>
                <div className={styles.avatarRing}>
                  <span className={styles.initial}>{a.initial}</span>
                  {isSelected ? <span className={styles.check}>✓</span> : null}
                </div>
                <div className={styles.name}>{a.name}</div>
                <div className={styles.role}>{a.role}</div>
                <div className={styles.status}>Mission day 170 · Stable demo telemetry</div>
              </button>
            );
          })}
        </div>
        <button type="button" className={styles.confirm} onClick={() => onSelect(selected)}>
          Continue as {chosen.name}
        </button>
        <div className={styles.hint}>Press 1, 2, or 3 to select · Press Enter to confirm</div>
        <p className={styles.footer}>Simulated crew · Demonstration only · Not medical advice</p>
      </section>
    </div>
  );
}