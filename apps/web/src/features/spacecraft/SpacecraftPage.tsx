import { Suspense, lazy, useEffect, useState } from "react";
import styles from "./SpacecraftPage.module.css";
import { DEFAULT_MODEL_ID, SPACECRAFT_MODELS } from "./model/models";
import { usePausedWhenHidden, useReducedMotion } from "./model/preferences";

// three.js and the models sit behind this import, so the HUD entry chunk stays light.
import { recoverFromChunkError } from "~/shared/chunk-recovery";

const SpacecraftScene = lazy(() =>
  import("./scene/SpacecraftScene").catch((error) => {
    recoverFromChunkError();
    throw error;
  }),
);

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * ISS test bench: renders the NASA ISS GLB models shipped in public/models/iss
 * so Sky can evaluate its 3D capability. Display only — no simulation, no data.
 */
export function SpacecraftPage() {
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [autoRotate, setAutoRotate] = useState(true);
  const [supported, setSupported] = useState<boolean | null>(null);
  const reducedMotion = useReducedMotion();
  const paused = usePausedWhenHidden();

  useEffect(() => {
    setSupported(webglAvailable());
  }, []);

  const model =
    SPACECRAFT_MODELS.find((candidate) => candidate.id === modelId) ?? SPACECRAFT_MODELS[0]!;

  return (
    <main className={styles.page}>
      <div className={styles.viewport}>
        <div className={styles.canvasArea}>
          {supported === null ? (
            <p className={styles.loading}>Preparing 3D…</p>
          ) : supported ? (
            <Suspense fallback={<p className={styles.loading}>Preparing 3D…</p>}>
              <SpacecraftScene
                modelUrl={model.url}
                autoRotate={autoRotate}
                reducedMotion={reducedMotion}
                paused={paused}
              />
            </Suspense>
          ) : (
            <div className={styles.fallback} role="status">
              <h2 className={styles.fallbackTitle}>3D is unavailable in this browser</h2>
              <p className={styles.fallbackDetail}>
                WebGL is switched off or unsupported, so the ISS model cannot be drawn. Every
                other part of the interface still works.
              </p>
            </div>
          )}
        </div>

        <header className={`${styles.overlay} ${styles.header}`}>
          <p className={styles.eyebrow}>Test display · not a simulation</p>
          <h1 className={styles.title}>SKY · Spacecraft digital twin — ISS test</h1>
          <p className={styles.subtitle}>
            NASA ISS models rendered with the app&apos;s 3D stack, to evaluate what Sky can show.
            Drag to orbit, scroll to zoom, right-drag to pan.
          </p>
        </header>

        <div className={`${styles.overlay} ${styles.controls}`}>
          <div>
            <p className={styles.controlLabel} id="spacecraft-model-label">
              Model
            </p>
            <div
              className={styles.modelGroup}
              role="group"
              aria-labelledby="spacecraft-model-label"
            >
              {SPACECRAFT_MODELS.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={styles.modelButton}
                  data-active={candidate.id === model.id}
                  aria-pressed={candidate.id === model.id}
                  onClick={() => setModelId(candidate.id)}
                >
                  {candidate.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={styles.controlLabel} id="spacecraft-rotate-label">
              Turntable
            </p>
            <button
              type="button"
              className={styles.rotateToggle}
              aria-pressed={autoRotate}
              aria-labelledby="spacecraft-rotate-label"
              onClick={() => setAutoRotate((value) => !value)}
            >
              Auto-rotate {autoRotate ? "on" : "off"}
            </button>
          </div>
        </div>

        <footer className={`${styles.overlay} ${styles.footer}`}>
          <p>
            NASA — NASA 3D Resources / NASA VTAD:{" "}
            <a
              href="https://science.nasa.gov/3d-resources/international-space-station-iss-b/"
              target="_blank"
              rel="noreferrer"
            >
              ISS (B) lightweight
            </a>
            {" · "}
            <a
              href="https://science.nasa.gov/resource/international-space-station-3d-model/"
              target="_blank"
              rel="noreferrer"
            >
              ISS full detail
            </a>
          </p>
          <p>
            NASA media usage guidelines — this display does not imply NASA endorsement.
          </p>
        </footer>
      </div>
    </main>
  );
}
