import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { tooltipPlacement, type HoverPoint } from "../model/hover";
import { structureDetails } from "../model/selection";

export interface HoverTooltipProps {
  /** The structure under the cursor, or null when the pointer is off the body. */
  readonly hover: HoverPoint | null;
}

// Before the first measurement: roughly the box a two-line tooltip takes.
const ESTIMATED_BOX = { width: 200, height: 42 };

/**
 * The catalog facts of whatever the cursor is over, as a small card that
 * follows the pointer. Catalog-only by design — a name, its system and its
 * category, the same fields the structure card shows — so it never claims a
 * medical fact and needs no source. No animation, so it holds still under
 * `prefers-reduced-motion`; it is `pointer-events-none`, so orbit and picking
 * keep the canvas.
 */
export function HoverTooltip({ hover }: HoverTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(ESTIMATED_BOX);
  const key = hover?.key ?? null;

  // The box only changes with the text, so measure when the structure does.
  useLayoutEffect(() => {
    if (key === null) return;
    const element = ref.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    setBox((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height },
    );
  }, [key]);

  const details = hover ? structureDetails(hover.key) : null;
  const style: CSSProperties = { "--swatch": details?.color ?? "var(--accent)" } as CSSProperties;
  if (hover) {
    const viewport =
      typeof window === "undefined"
        ? { width: 0, height: 0 }
        : { width: window.innerWidth, height: window.innerHeight };
    const placement = tooltipPlacement(hover.x, hover.y, viewport, box);
    style.left = `${placement.left}px`;
    style.top = `${placement.top}px`;
  }

  return (
    <div
      ref={ref}
      role="tooltip"
      aria-hidden={hover === null}
      data-visible={hover ? "true" : "false"}
      className="pointer-events-none fixed z-[20] max-w-[min(220px,calc(100vw_-_16px))] rounded-(--radius-sm) border border-(--accent)/22 bg-(--bg)/85 px-[10px] py-[7px] backdrop-blur-[6px] select-none data-[visible=false]:hidden"
      style={style}
    >
      {details ? (
        <>
          <span className="flex items-center gap-[7px] font-(family-name:--mono) text-[11px] leading-[1.35] font-medium text-(--text)">
            <span
              className="size-[7px] flex-none rounded-[2px] [background-color:var(--swatch,var(--accent))] [box-shadow:0_0_7px_color-mix(in_srgb,var(--swatch,var(--accent))_55%,transparent)]"
              aria-hidden="true"
            />
            {details.label}
          </span>
          <span className="mt-[3px] block text-[10px] leading-[1.4] text-(--muted)">
            {details.systemLabel} · {details.category}
          </span>
        </>
      ) : null}
    </div>
  );
}
