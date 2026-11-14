import type { CSSProperties } from "react";
import styles from "../BodyMapOverlay.module.css";
import { structureDetails } from "../model/selection";

export interface StructureCardProps {
  readonly selected: string;
  /** Clears the selection; the camera then returns to the full body. */
  readonly onClear: () => void;
}

/**
 * The selected structure: catalog facts, its colour, and — for the heart, the
 * lungs and the brain — the simulated HUD readings. Every number is rendered
 * from `VITAL_VALUES` through `structureDetails`, never written in prose.
 */
export function StructureCard({ selected, onClear }: StructureCardProps) {
  const details = structureDetails(selected);
  // The swatch colour is data from the catalog, so it travels as a custom property
  // and the stylesheet owns every visual rule.
  const swatchStyle = { "--swatch": details.color } as CSSProperties;

  return (
    <aside className={styles.card} aria-label={`Selected structure: ${details.label}`}>
      <div className={styles.cardHead}>
        <span className={styles.eyebrow}>Selected structure</span>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onClear}
          aria-label="Clear selection"
        >
          ×
        </button>
      </div>

      <h3 className={styles.cardTitle}>
        <span className={styles.swatch} style={swatchStyle} aria-hidden="true" />
        {details.label}
      </h3>

      <dl className={styles.facts}>
        <div>
          <dt>System</dt>
          <dd>{details.systemLabel}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{details.category}</dd>
        </div>
      </dl>

      {details.vitals.length > 0 ? (
        <ul className={styles.readings}>
          {details.vitals.map((reading) => (
            <li key={reading.label}>
              <span>{reading.label}</span>
              <strong>{reading.value}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>
          {details.known
            ? "Catalog structure. No simulated reading is attached to this region."
            : "This mesh is not in the catalog."}
        </p>
      )}

      <p className={styles.note}>Simulated data — no live sensor is connected.</p>
      <button type="button" className={styles.ghostButton} onClick={onClear}>
        Back to full body
      </button>
    </aside>
  );
}
