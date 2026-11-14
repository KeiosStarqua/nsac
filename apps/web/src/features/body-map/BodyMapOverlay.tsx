import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { ATTRIBUTION } from "open-anatomy-3d";
import styles from "./BodyMapOverlay.module.css";
import { LayerRail } from "./components/LayerRail";
import { StructureCard } from "./components/StructureCard";
import { DEFAULT_LAYERS, type LayerMap } from "./model/layers";
import { usePausedWhenHidden, useReducedMotion } from "./model/preferences";

// three.js and the model sit behind this import, so the HUD entry chunk stays light.
const BodyScene = lazy(() => import("./scene/BodyScene"));

export interface BodyMapOverlayProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The body hologram: a full-screen glass panel around the Open Anatomy 3D male
 * model. Selecting a mesh shows its catalog facts and, for the heart, lungs and
 * brain, the simulated HUD readings. Nothing is measured; the panel says so.
 */
export function BodyMapOverlay({ open, onClose }: BodyMapOverlayProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerMap>(DEFAULT_LAYERS);
  const [supported, setSupported] = useState<boolean | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const paused = usePausedWhenHidden();

  const close = useCallback(() => {
    setSelected(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    setSupported(webglAvailable());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus();
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="body-map-title"
      tabIndex={-1}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>SKY · living anatomy</p>
          <h2 id="body-map-title" className={styles.title}>
            Body hologram
          </h2>
          <p className={styles.subtitle}>
            Open Anatomy 3D male model. Pick a structure to read its catalog facts and, where the
            HUD has one, its simulated value.
          </p>
        </div>
        <button type="button" className={styles.closeButton} onClick={close} aria-label="Close body map">
          Close
        </button>
      </header>

      <div className={styles.stage}>
        <div className={styles.viewport}>
          {supported === null ? (
            <p className={styles.loading}>Preparing the hologram…</p>
          ) : (
            <Suspense fallback={<p className={styles.loading}>Preparing the hologram…</p>}>
              <BodyScene
                webglAvailable={supported}
                selected={selected}
                onSelect={setSelected}
                layers={layers}
                reducedMotion={reducedMotion}
                paused={paused}
              />
            </Suspense>
          )}
          {selected ? <StructureCard selected={selected} onClear={() => setSelected(null)} /> : null}
        </div>

        <div className={styles.sidebar}>
          <LayerRail layers={layers} setLayers={setLayers} />
        </div>
      </div>

      <footer className={styles.footer}>
        <p>{ATTRIBUTION}</p>
        <p>
          Model licence:{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          . Simulated data, not for diagnosis.
        </p>
      </footer>
    </div>
  );
}
