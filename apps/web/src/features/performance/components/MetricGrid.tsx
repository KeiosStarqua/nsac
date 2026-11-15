import type { MetricTileModel } from "../model/metrics";
import { MetricTile } from "./MetricTile";

const GRID = [
  "grid grid-cols-1 gap-3",
  "min-[520px]:grid-cols-2",
  "xl:grid-cols-3",
].join(" ");

interface MetricGridProps {
  tiles: MetricTileModel[];
  ariaLabel: string;
  deltaCaption: string;
  simulatedLabel: string;
}

/** The 12-tile metric grid, in BGK priority order (see `METRIC_ORDER`). */
export function MetricGrid({ tiles, ariaLabel, deltaCaption, simulatedLabel }: MetricGridProps) {
  return (
    <div className={GRID} aria-label={ariaLabel} role="group">
      {tiles.map((tile) => (
        <MetricTile
          key={tile.id}
          tile={tile}
          deltaCaption={deltaCaption}
          simulatedLabel={simulatedLabel}
        />
      ))}
    </div>
  );
}
