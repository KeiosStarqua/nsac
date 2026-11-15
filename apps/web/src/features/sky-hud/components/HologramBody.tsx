import { Component, Suspense, lazy, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { recoverFromChunkError } from "~/shared/chunk-recovery";
import { HoloSvg } from "./HoloSvg";

// three.js and the model sit behind this import, so the HUD entry chunk stays free of WebGL.
const HoloScene = lazy(() =>
  import("./HoloScene").catch((error) => {
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

interface HoloSceneBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}

/**
 * Thin error boundary for the card scene: a failed GLB (meshopt) load or a lost WebGL context
 * would otherwise blank the card. R3F rethrows canvas errors into the DOM tree, so this catches
 * them and puts the drawn figure back. It stays local on purpose — the card must not depend on
 * the body map's internals.
 */
class HoloSceneBoundary extends Component<HoloSceneBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn("[sky-hud] hologram scene failed:", error.message, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function HoloViewport({ reducedMotion }: { reducedMotion: boolean }) {
  // The drawn figure stays until the model has actually mounted, so the card never shows an empty
  // box while the 876 KB GLB loads in the background (the page paints first regardless).
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  return (
    <HoloSceneBoundary fallback={<HoloSvg />}>
      {ready ? null : <HoloSvg />}
      <Suspense fallback={null}>
        <HoloScene reducedMotion={reducedMotion} onReady={handleReady} />
      </Suspense>
    </HoloSceneBoundary>
  );
}

export interface HologramBodyProps {
  /** `prefers-reduced-motion`: the figure stops spinning. */
  readonly reducedMotion?: boolean;
}

/**
 * Minimal 3D body for the HUD health card, on both consoles (`/` mock, `?arch=openui`): the
 * Open Anatomy skin shell and skeleton only, framed whole-body on a transparent canvas, slowly
 * turning. It reuses the body map's material spec (`features/body-map/model/materials.ts`) and
 * camera framing, drops every interaction (no orbit, no picking, no hotspots, no rail) and leaves
 * the pointer to the `#hologramButton` link around it. The asset is pre-flattened at the pubis by
 * `scripts/holo-model.ts`, so the card keeps no runtime geometry surgery of its own.
 *
 * Fallbacks: the hand-drawn `HoloSvg` is what SSR and first paint render, and it comes back while
 * the scene chunk loads, when WebGL is unavailable, and when the GLB fails.
 */
export function HologramBody({ reducedMotion = false }: HologramBodyProps) {
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    setWebgl(webglAvailable());
  }, []);

  // `null` on the server and on first paint: keep exactly the markup the card always had.
  if (webgl !== true) return <HoloSvg />;

  return <HoloViewport reducedMotion={reducedMotion} />;
}
