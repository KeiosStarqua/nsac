import type { Frame } from "~/shared/scenario/types";

interface Props {
  frames: Frame[];
  day: number;
  total: number;
}

/** Stacked bars per day: incubating (yellow), sick (red), recovered (green). The current day is outlined. */
export function EpidemicCurve({ frames, day, total }: Props) {
  const w = 14;
  const gap = 3;
  const h = 90;
  const unit = h / Math.max(1, total);
  return (
    <svg
      className="curve"
      viewBox={`0 0 ${frames.length * (w + gap)} ${h + 4}`}
      role="img"
      aria-label="Crew health over the mission"
    >
      {frames.map((f) => {
        const visible = f.day <= day;
        const x = f.day * (w + gap);
        const parts = [
          { n: f.summary.recovered, fill: "#3ddc97" },
          { n: f.summary.infectious, fill: "#ff5d73" },
          { n: f.summary.exposed, fill: "#ffc857" },
        ];
        let y = h;
        return (
          <g key={f.day} opacity={visible ? 1 : 0.12}>
            {parts.map((p, i) => {
              const bh = p.n * unit;
              y -= bh;
              return bh > 0 ? <rect key={i} x={x} y={y} width={w} height={bh} fill={p.fill} /> : null;
            })}
            {f.day === day ? (
              <rect x={x - 1} y={0} width={w + 2} height={h + 2} fill="none" stroke="#e8eefc" strokeWidth={1.5} rx={3} />
            ) : null}
            <title>{`Day ${f.day}: ${f.summary.infectious} sick`}</title>
          </g>
        );
      })}
    </svg>
  );
}
