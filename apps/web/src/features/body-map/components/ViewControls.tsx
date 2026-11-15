import { Focus, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

export interface ViewControlsProps {
  readonly onRotateLeft: () => void;
  readonly onRotateRight: () => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onReset: () => void;
}

/**
 * Non-drag access to the hologram (DESIGN.md, BodyVolume rule): rotate, zoom
 * and a Reset View for orbit users who cannot or do not drag — every action a
 * pointer or keyboard user can reach without the canvas. Fixed-English copy,
 * 44px touch targets, Escape keeps its own meaning (leave the page).
 */
export function ViewControls({ onRotateLeft, onRotateRight, onZoomIn, onZoomOut, onReset }: ViewControlsProps) {
  const buttonClass =
    "inline-flex size-[44px] cursor-pointer items-center justify-center border-0 bg-transparent text-(--muted) transition-colors duration-200 hover:bg-(--accent)/10 hover:text-(--text) motion-reduce:transition-none";
  return (
    <div
      role="group"
      aria-label="View controls"
      className="absolute top-[12px] left-1/2 z-10 flex -translate-x-1/2 items-center overflow-hidden rounded-[999px]! border border-(--accent)/22 bg-(--surface)/78 backdrop-blur-[6px] [box-shadow:0_10px_34px_rgba(0,0,0,0.4)] max-[900px]:top-1/2 max-[900px]:right-[10px] max-[900px]:left-auto max-[900px]:translate-x-0 max-[900px]:-translate-y-1/2 max-[900px]:flex-col max-[900px]:rounded-(--radius)!"
    >
      <button type="button" onClick={onRotateLeft} aria-label="Rotate body left" className={buttonClass}>
        <RotateCcw size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button type="button" onClick={onRotateRight} aria-label="Rotate body right" className={buttonClass}>
        <RotateCw size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <span aria-hidden="true" className="h-[28px] w-px bg-(--accent)/18 max-[900px]:h-px max-[900px]:w-[28px]" />
      <button type="button" onClick={onZoomIn} aria-label="Zoom in" className={buttonClass}>
        <ZoomIn size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button type="button" onClick={onZoomOut} aria-label="Zoom out" className={buttonClass}>
        <ZoomOut size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <span aria-hidden="true" className="h-[28px] w-px bg-(--accent)/18 max-[900px]:h-px max-[900px]:w-[28px]" />
      <button type="button" onClick={onReset} aria-label="Reset view" className={buttonClass}>
        <Focus size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
}
