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
 * Full-screen cinematic viewer for the NASA ISS. No panels,
 * no controls: just the station adrift over a Webb nebula backdrop. Orbit and
 * zoom stay available; Escape returns to the HUD.
 */
export function SpacecraftPage() {
  const [supported, setSupported] = useState<boolean | null>(null);
  // ?stream=0 → one-shot full-detail GLB (the pre-streaming behaviour).
  // ?part=<id>  → dev-only: stream just one part of the streamed model.
  const [stream, setStream] = useState(true);
  const [onlyPart, setOnlyPart] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const paused = usePausedWhenHidden();
  const navigate = useNavigate();

  useEffect(() => {
    setSupported(webglAvailable());
    const params = new URLSearchParams(window.location.search);
    setStream(params.get("stream") !== "0");
    const part = params.get("part");
    setOnlyPart(part && /^[a-z0-9-]{1,40}$/i.test(part) ? part : null);
  }, []);

  // Escape is the only deliberate way back — there is no chrome on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") navigate({ to: "/" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // Default data path: ISS-B paints first, the full-detail model streams in
  // around the camera, then crossfades. ?stream=0 loads the full-detail GLB in
  // one shot instead (pre-streaming behaviour). There is no UI toggle.
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
            stream={stream}
            onlyPart={onlyPart}
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
