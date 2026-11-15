import type { DeltaDirection } from "../model/metrics";

const WIDTH = 100;
const HEIGHT = 30;
const PAD = 2;

/**
 * Inline 30-point sparkline. Hand-rolled SVG on purpose: 12 of these render on the page, so the
 * vendored Arc `Sparkline` (motion + ResizeObserver + scrubbing per instance) would cost far more
 * client JS than the demo needs. No ids, no gradients — the markup is identical on server and client.
 */
export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  const data = points.filter((value) => Number.isFinite(value));
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const count = data.length;
  const coords = data.map((value, index) => {
    const x = count === 1 ? WIDTH : (index / (count - 1)) * WIDTH;
    const y = PAD + (1 - (value - min) / span) * (HEIGHT - PAD * 2);
    return [x, y] as const;
  });
  const polyline = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `M${coords[0]![0].toFixed(2)},${HEIGHT} L${coords
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" L")} L${coords[coords.length - 1]![0].toFixed(2)},${HEIGHT} Z`;
  const [lastX, lastY] = coords[coords.length - 1]!;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={area} fill="rgba(94,234,212,0.10)" />
      <polyline
        points={polyline}
        fill="none"
        stroke="#5eead4"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="1.9" fill="#b8fff1" />
    </svg>
  );
}

/** Up / down / flat glyph. Direction only — the demo never paints a metric red. */
export function DeltaGlyph({ direction }: { direction: DeltaDirection }) {
  if (direction === "flat") {
    return <span aria-hidden="true" className="inline-block h-[1.5px] w-[8px] rounded-full bg-current" />;
  }
  return (
    <span aria-hidden="true" className="text-[9px] leading-none">
      {direction === "up" ? "▲" : "▼"}
    </span>
  );
}
