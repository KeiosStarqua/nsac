import { sparklinePath } from "../model/sparklines";

export interface SparklineProps {
  readonly points: readonly number[];
  readonly className?: string;
  readonly width?: number;
  readonly height?: number;
}

/**
 * Inline cubic sparkline (inline SVG only — no dependency, identical markup on server and client).
 * Purely decorative: `aria-hidden`, no ids, no gradients, so many instances can share a page.
 */
export function Sparkline({ points, className, width = 100, height = 32 }: SparklineProps) {
  const geometry = sparklinePath(points, width, height);
  if (!geometry) return null;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={geometry.area} fill="rgba(94,234,212,0.10)" />
      <path
        d={geometry.line}
        fill="none"
        stroke="#5eead4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={geometry.last[0]} cy={geometry.last[1]} r="1.8" fill="#b8fff1" />
    </svg>
  );
}
