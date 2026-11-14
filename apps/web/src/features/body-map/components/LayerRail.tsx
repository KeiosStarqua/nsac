import type { Dispatch, SetStateAction } from "react";
import { SYSTEM_LABELS } from "open-anatomy-3d";
import styles from "../BodyMapOverlay.module.css";
import { LAYER_KEYS, toggleLayer, type LayerState as LayerMap } from "../model/layers";

export interface LayerRailProps {
  readonly layers: LayerMap;
  readonly setLayers: Dispatch<SetStateAction<LayerMap>>;
}

/**
 * One toggle per body system (all seven catalog systems, joints included).
 * The last visible layer cannot be switched off, so the hologram is never empty.
 */
export function LayerRail({ layers, setLayers }: LayerRailProps) {
  return (
    <section className={styles.rail} aria-label="Body systems">
      <h3 className={styles.railTitle}>Body systems</h3>
      <p className={styles.note}>Toggle what the hologram shows. At least one system stays on.</p>
      <ul className={styles.layerList}>
        {LAYER_KEYS.map((key) => (
          <li key={key}>
            <button
              type="button"
              className={styles.layerButton}
              aria-pressed={layers[key]}
              data-on={layers[key] ? "true" : "false"}
              onClick={() => setLayers((previous: LayerMap) => toggleLayer(previous, key))}
            >
              <span className={styles.layerDot} aria-hidden="true" />
              {SYSTEM_LABELS[key]}
              <span className={styles.layerState}>{layers[key] ? "on" : "off"}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
