import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
 * Full-screen cinematic viewer for the NASA ISS full-detail GLB. No panels,
 * no controls: just the station adrift over a Webb nebula backdrop. Orbit and
 * zoom stay available; Escape returns to the HUD.
 */
export function SpacecraftPage() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const reducedMotion = useReducedMotion();
  const paused = usePausedWhenHidden();
  const navigate = useNavigate();

  useEffect(() => {
    setSupported(webglAvailable());
  }, []);

  // Escape is the only deliberate way back — there is no chrome on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") navigate({ to: "/" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // The full-detail model is the only one rendered. Both GLBs remain in the
  // catalog and loader path (see model/models.ts); there is no picker.
  const modelUrl =
    SPACECRAFT_MODELS.find((candidate) => candidate.id === DEFAULT_MODEL_ID)?.url ??
    SPACECRAFT_MODELS[0]!.url;

  return (
    <main className={styles.page} aria-label="ISS — cinematic 3D view">
      {/* Deep-black universe with a very dim Webb "Cosmic Cliffs" backdrop and
          blue/violet nebula tints. Sits behind the transparent canvas. */}
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.backdropImage} />
        <div className={styles.backdropTint} />
      </div>
      {/* Light fake-bloom: a soft cyan halo behind the station. */}
      <div className={styles.glow} aria-hidden="true" />

      {supported === null ? null : supported ? (
        <Suspense fallback={null}>
          <SpacecraftScene
            modelUrl={modelUrl}
            autoRotate
            reducedMotion={reducedMotion}
            paused={paused}
          />
        </Suspense>
      ) : (
        <div className={styles.fallback} role="status">
          <p className={styles.fallbackText}>Spacecraft unavailable</p>
        </div>
      )}
      <div className={styles.vignette} aria-hidden="true" />
    </main>
  );
}
