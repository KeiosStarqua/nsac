import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { ATTRIBUTION } from "open-anatomy-3d";
import { LayerRail } from "./components/LayerRail";
import { StructureCard } from "./components/StructureCard";
import { DEFAULT_LAYERS, type LayerMap } from "./model/layers";
import { usePausedWhenHidden, useReducedMotion } from "./model/preferences";

// three.js and the model sit behind this import, so the HUD entry chunk stays light.
import { recoverFromChunkError } from "~/shared/chunk-recovery";

const BodyScene = lazy(() =>
  import("./scene/BodyScene").catch((error) => {
    recoverFromChunkError();
    throw error;
  }),
);

export interface BodyMapOverlayProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /**
   * `overlay` — the HUD glass panel (header, structure card, footer). `page` —
   * the `/body` route: the canvas covers the viewport, only the floating
   * "Body systems" rail and one attribution line stay.
   */
  readonly variant?: "overlay" | "page";
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
 *
 * Styling note: the utilities here are Tailwind v4 and the app reset in
 * `src/styles/global.css` is unlayered, so it wins over the layered utilities.
 * A utility whose property that reset also declares on the same element (a
 * heading's letter-spacing, a button's font-size, the focus-visible radius, a
 * paragraph's margin) carries `!` to keep the pre-migration rendering.
 */
export function BodyMapOverlay({
  open,
  onClose,
  variant = "overlay",
}: BodyMapOverlayProps) {
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

  // The scene subtree both variants share: the 3D canvas, its preparation state
  // and the WebGL/GLB fallbacks. Nothing else lives in here.
  const scene = (
    <>
      {supported === null ? (
        <p className="absolute inset-0 m-0 grid place-items-center p-[24px] text-center font-(family-name:--mono) text-[11px] tracking-[0.18em] uppercase text-(--muted)">
          Preparing the hologram…
        </p>
      ) : (
        <Suspense
          fallback={
            <p className="absolute inset-0 m-0 grid place-items-center p-[24px] text-center font-(family-name:--mono) text-[11px] tracking-[0.18em] uppercase text-(--muted)">
              Preparing the hologram…
            </p>
          }
        >
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
    </>
  );

  if (variant === "page") {
    return (
      <div
        ref={dialogRef}
        className="fixed inset-0 z-[1000] overflow-hidden bg-(--bg) text-(--text)"
        role="main"
        aria-labelledby="body-map-title"
        tabIndex={-1}
      >
        <h1 id="body-map-title" className="sr-only">
          Body hologram
        </h1>

        {/* The canvas owns the viewport: the panel's #050c16 radial, no frame. */}
        <div className="absolute inset-0 overflow-hidden rounded-none border-0 [background:radial-gradient(80%_70%_at_50%_18%,color-mix(in_srgb,var(--surface)_48%,transparent),transparent_70%),#050c16] [box-shadow:inset_0_0_90px_rgba(0,0,0,0.45)]">
          {scene}
        </div>

        {/* "Body systems" rides over the canvas: right and centred on desktop, a
            bottom row under 900px (the rail itself wraps; see LayerRail). */}
        <div className="absolute top-1/2 right-[clamp(14px,2vw,28px)] z-10 w-[248px] -translate-y-1/2 max-[900px]:inset-x-[12px] max-[900px]:top-auto max-[900px]:bottom-[12px] max-[900px]:w-auto max-[900px]:translate-y-0">
          <LayerRail layers={layers} setLayers={setLayers} />
        </div>

        {/* CC BY 4.0: the attribution stays wherever the model appears. */}
        <p className="pointer-events-none absolute bottom-[10px] left-[14px] z-10 m-0 max-w-[min(160ch,calc(100%_-_28px))] text-[10px] leading-[1.5] text-(--muted) opacity-[0.72] [text-shadow:0_1px_6px_rgba(0,0,0,0.9)] max-[900px]:bottom-auto max-[900px]:top-[12px] max-[900px]:left-[12px]">
          {ATTRIBUTION} Model licence:{" "}
          <a
            className="pointer-events-auto border-b border-b-(--accent)/40 text-(--accent) no-underline hover:text-(--text)!"
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
          </a>
          . Simulated data, not for diagnosis.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[1000] flex flex-col gap-[clamp(12px,1.6vw,20px)] overflow-hidden p-[clamp(14px,2vw,28px)] text-(--text) [background:radial-gradient(115%_85%_at_50%_-10%,color-mix(in_srgb,var(--accent)_12%,transparent),transparent_62%),color-mix(in_srgb,var(--bg)_93%,transparent)] [backdrop-filter:blur(18px)_saturate(120%)] max-[900px]:overflow-y-auto motion-reduce:[backdrop-filter:none]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="body-map-title"
      tabIndex={-1}
    >
      <header className="flex items-start justify-between gap-[18px]">
        <div className="flex min-w-0 flex-col gap-[6px]">
          <p className="m-0 font-(family-name:--mono) text-[10px] tracking-[0.24em] uppercase text-(--accent)">
            SKY · living anatomy
          </p>
          <h2
            id="body-map-title"
            className="m-0 font-(family-name:--font-display) text-[clamp(20px,2.2vw,30px)] font-light leading-[1.15]! tracking-[0.01em]!"
          >
            Body hologram
          </h2>
          <p className="m-0 max-w-[62ch] text-[13px] leading-[1.5] text-(--muted)">
            Open Anatomy 3D male model. Pick a structure to read its catalog facts and, where the
            HUD has one, its simulated value.
          </p>
        </div>
        <button
          type="button"
          className="flex-none cursor-pointer rounded-[999px]! border border-(--accent)/32 bg-(--surface)/62 px-[18px] py-[8px] text-[13px]! text-(--text) transition-[border-color,background-color] duration-200 ease-[ease] hover:border-(--accent) hover:bg-(--accent)/12 motion-reduce:transition-none"
          onClick={close}
          aria-label="Close body map"
        >
          Close
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_248px] gap-[clamp(12px,1.4vw,18px)] max-[900px]:grid-cols-[minmax(0,1fr)] max-[900px]:grid-rows-[minmax(0,1fr)_auto]">
        <div className="relative min-h-0 overflow-hidden rounded-(--radius) border border-(--accent)/22 [background:radial-gradient(80%_70%_at_50%_18%,color-mix(in_srgb,var(--surface)_48%,transparent),transparent_70%),#050c16] [box-shadow:inset_0_0_90px_rgba(0,0,0,0.45)] max-[900px]:min-h-[54vh]">
          {scene}
          {selected ? <StructureCard selected={selected} onClear={() => setSelected(null)} /> : null}
        </div>

        <div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto max-[900px]:overflow-visible">
          <LayerRail layers={layers} setLayers={setLayers} />
        </div>
      </div>

      <footer className="flex flex-wrap items-baseline gap-[4px_20px] border-t border-t-(--accent)/14 pt-[2px] text-[11px] leading-[1.5] text-(--muted)">
        <p className="m-0 max-w-[92ch]">{ATTRIBUTION}</p>
        <p className="m-0">
          Model licence:{" "}
          <a
            className="border-b border-b-(--accent)/40 text-(--accent) no-underline hover:text-(--text)!"
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 4.0
          </a>
          . Simulated data, not for diagnosis.
        </p>
      </footer>
    </div>
  );
}
