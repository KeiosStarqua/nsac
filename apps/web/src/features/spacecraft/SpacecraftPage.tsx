import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
// The nebula drift keyframes (the one bit of motion Tailwind cannot inline).
import "./nebula-drift.css";
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
    <main
      className="relative h-[100vh] overflow-hidden bg-black text-(--text) supports-[height:100dvh]:h-[100dvh]"
      aria-label="ISS — cinematic 3D view"
    >
      {/* Deep-black universe with a very dim Webb "Cosmic Cliffs" backdrop and
          blue/violet nebula tints. Sits behind the transparent canvas. */}
      <div className="absolute inset-0 overflow-hidden bg-black" aria-hidden="true">
        <div className="absolute -inset-[6%] [background-image:url(/spacecraft/cosmic-cliffs-web.jpg)] bg-cover [background-position:center_30%] opacity-[0.24] [filter:saturate(0.72)_brightness(0.85)] animate-[nebulaDrift_110s_ease-in-out_infinite_alternate] motion-reduce:animate-none" />
        <div className="absolute inset-0 [background:radial-gradient(70%_55%_at_16%_80%,rgba(88,72,214,0.22),transparent_65%),radial-gradient(65%_52%_at_84%_14%,rgba(45,108,196,0.24),transparent_62%),radial-gradient(120%_105%_at_50%_50%,transparent_42%,rgba(0,0,0,0.82)_100%),linear-gradient(180deg,rgba(0,0,0,0.68)_0%,rgba(1,3,9,0.38)_28%,rgba(1,3,9,0.34)_60%,rgba(0,0,0,0.85)_100%)]" />
      </div>
      {/* Light fake-bloom: a soft cyan halo behind the station. */}
      <div
        className="pointer-events-none absolute inset-0 [background:radial-gradient(40%_32%_at_50%_46%,rgba(140,205,255,0.1),rgba(140,205,255,0.035)_45%,transparent_75%)]"
        aria-hidden="true"
      />

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
        <div className="absolute inset-0 grid place-items-center p-[28px]" role="status">
          <p className="m-0 font-(family-name:--mono) text-[11px] tracking-[0.22em] uppercase text-(--muted)/80">
            Spacecraft unavailable
          </p>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_18vmax_rgba(0,0,0,0.72)]"
        aria-hidden="true"
      />
    </main>
  );
}
