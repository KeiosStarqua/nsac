import type { MetricTileModel } from "../model/metrics";
import { DeltaGlyph, Sparkline } from "./Sparkline";

const CARD = [
  "group relative overflow-hidden rounded-2xl border border-[rgba(94,234,212,0.14)]",
  "bg-[linear-gradient(158deg,rgba(17,26,46,0.94),rgba(9,17,32,0.88))]",
  "p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
  "[transition:border-color_.2s,transform_.2s] hover:border-[rgba(94,234,212,0.28)]",
].join(" ");

interface MetricTileProps {
  tile: MetricTileModel;
  deltaCaption: string;
  simulatedLabel: string;
}

/** One of the 12 metric tiles. Label, value + unit, 30-day delta, sparkline, method badge. */
export function MetricTile({ tile, deltaCaption, simulatedLabel }: MetricTileProps) {
  return (
    <article data-testid="metric-tile" data-metric={tile.id} data-fixture={tile.fromFixture || undefined} className={CARD}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="m-0! text-[10.5px] font-medium uppercase leading-[1.35] tracking-[0.18em] text-(--muted)">
          {tile.label}
        </h3>
        <span className="flex-none rounded-full border border-[rgba(94,234,212,0.24)] px-1.5 py-[2px] text-[8px] uppercase tracking-[0.14em] text-[rgba(142,240,217,0.72)]">
          {simulatedLabel}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[30px] font-light leading-none tracking-[-0.02em] tabular-nums text-(--text)">
          {tile.value}
        </span>
        <span className="text-[12px] font-light text-(--muted)">{tile.unit}</span>
      </div>

      <div className="mt-[6px] flex items-center gap-1.5 text-[11px] tabular-nums text-[#8ef0d9]">
        <DeltaGlyph direction={tile.direction} />
        <span>{tile.deltaText}</span>
        <span className="text-[10px] tracking-[0.04em] text-(--muted)/80">{deltaCaption}</span>
      </div>

      <Sparkline points={tile.points} className="mt-2.5 block h-[38px] w-full" />

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full border border-[rgba(148,163,184,0.22)] px-[7px] py-[2px] text-[9px] uppercase tracking-[0.1em] text-[rgba(154,169,196,0.9)]">
          {tile.methodLabel}
        </span>
        <span className="text-[8.5px] uppercase tracking-[0.18em] text-(--muted)/60">30d</span>
      </div>
    </article>
  );
}
