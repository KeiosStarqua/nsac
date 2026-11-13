import { useLocale } from "~/shared/i18n";
import { strings } from "./strings";
import "./tokens.css";

interface Point { id: string; angle: number; quality?: "good" | "limited" | "unknown"; }

interface Props { points: Point[]; }

const colorFor = (q?: string) => q === "limited" ? "#FFBF64" : q === "unknown" ? "#526B83" : "#59E8F3";

export function Filaments({ points }: Props) {
  const locale = useLocale();
  const t = strings[locale];
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <svg className="sky-living-filaments" viewBox="0 0 200 200" width="100%" height="100%" aria-label={t.simulated}>
      {points.map((p) => {
        const rad = (p.angle / 360) * Math.PI * 2 - Math.PI / 2;
        const x = 100 + Math.cos(rad) * 80;
        const y = 100 + Math.sin(rad) * 80;
        return (
          <path
            key={p.id}
            d={`M100,100 Q${(100+x)/2},${(100+y)/2 - 10} ${x},${y}`}
            fill="none"
            stroke={colorFor(p.quality)}
            strokeWidth={1.5}
            strokeDasharray={p.quality === "limited" ? "4 3" : undefined}
            opacity={0.8}
            style={reduce ? {} : { animation: "sl-shimmer 4s ease-in-out infinite" }}
          />
        );
      })}
      <style>{`@keyframes sl-shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
    </svg>
  );
}