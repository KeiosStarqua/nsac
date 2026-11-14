import { useEffect, useState } from "react";
import { ASTRONAUTS } from "../model/astronauts";
import styles from "./AstronautPicker.module.css";

interface Props {
  readonly open: boolean;
  readonly onSelect: (id: string) => void;
}

export function AstronautPicker({ open, onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (open) setSelected(null);
  }, [open]);
  if (!open) return null;
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="astronaut-picker-title">
      <section className={styles.panel}>
        <p className={styles.eyebrow}>SKY · crew</p>
        <h2 id="astronaut-picker-title" className={styles.title}>Select astronaut</h2>
        <p className={styles.subtitle}>Choose who Sky is assisting. Stored on this device only.</p>
        <div className={styles.list}>
          {ASTRONAUTS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={styles.card + (selected === a.id ? " " + styles.cardSelected : "")}
              onClick={() => setSelected(a.id)}
            >
              <span className={styles.initial}>{a.initial}</span>
              <span className={styles.name}>{a.name}</span>
              <span className={styles.role}>{a.role}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.confirm}
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          Enter HUD
        </button>
      </section>
    </div>
  );
}