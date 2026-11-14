import type { CSSProperties } from "react";
import { structureDetails } from "../model/selection";

export interface StructureCardProps {
  readonly selected: string;
  /** Clears the selection; the camera then returns to the full body. */
  readonly onClear: () => void;
}

/**
 * The selected structure: catalog facts, its colour, and — for the heart, the
 * lungs and the brain — the simulated HUD readings. Every number is rendered
 * from `VITAL_VALUES` through `structureDetails`, never written in prose.
 */
export function StructureCard({ selected, onClear }: StructureCardProps) {
  const details = structureDetails(selected);
  // The swatch colour is data from the catalog, so it travels as a custom property
  // that the utilities read.
  const swatchStyle = { "--swatch": details.color } as CSSProperties;

  return (
    <aside
      className="absolute top-[14px] right-[14px] flex max-h-[calc(100%_-_28px)] w-[min(286px,calc(100%_-_28px))] flex-col gap-[10px] overflow-y-auto rounded-(--radius) border border-(--accent)/28 p-[16px] [background-color:color-mix(in_srgb,var(--surface-2)_88%,transparent)] [backdrop-filter:blur(12px)_saturate(115%)] [box-shadow:var(--shadow-raised)] max-[900px]:top-auto max-[900px]:right-[12px] max-[900px]:bottom-[12px] max-[900px]:left-[12px] max-[900px]:max-h-[46%] max-[900px]:w-auto"
      aria-label={`Selected structure: ${details.label}`}
    >
      <div className="flex items-center justify-between gap-[10px]">
        <span className="font-(family-name:--mono) text-[10px] tracking-[0.24em] uppercase text-(--accent)">
          Selected structure
        </span>
        <button
          type="button"
          className="grid size-[26px] flex-none cursor-pointer place-items-center rounded-[50%]! border border-(--accent)/24 bg-transparent text-[16px]! leading-none! text-(--muted) hover:border-(--accent) hover:text-(--text)"
          onClick={onClear}
          aria-label="Clear selection"
        >
          ×
        </button>
      </div>

      <h3 className="m-0 flex items-center gap-[9px] text-[17px] font-normal leading-[1.25]!">
        <span
          className="size-[12px] flex-none rounded-[3px] [background-color:var(--swatch,var(--accent))] [box-shadow:0_0_10px_color-mix(in_srgb,var(--swatch,var(--accent))_60%,transparent)]"
          style={swatchStyle}
          aria-hidden="true"
        />
        {details.label}
      </h3>

      <dl className="m-0 flex flex-col gap-[5px] text-[12px]">
        <div className="flex items-baseline justify-between gap-[12px] border-b border-b-(--border)/70 pb-[5px]">
          <dt className="font-(family-name:--mono) text-[9px] tracking-[0.16em] uppercase text-(--muted)">
            System
          </dt>
          <dd className="m-0 text-right">{details.systemLabel}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-[12px] border-b border-b-(--border)/70 pb-[5px]">
          <dt className="font-(family-name:--mono) text-[9px] tracking-[0.16em] uppercase text-(--muted)">
            Category
          </dt>
          <dd className="m-0 text-right">{details.category}</dd>
        </div>
      </dl>

      {details.vitals.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-[7px] p-0 text-[13px]">
          {details.vitals.map((reading) => (
            <li key={reading.label} className="flex items-baseline justify-between gap-[12px]">
              <span className="text-(--muted)">{reading.label}</span>
              <strong className="font-normal whitespace-nowrap text-(--accent)">{reading.value}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[12px] leading-[1.55] text-(--muted)">
          {details.known
            ? "Catalog structure. No simulated reading is attached to this region."
            : "This mesh is not in the catalog."}
        </p>
      )}

      <p className="m-0 text-[12px] leading-[1.55] text-(--muted)">
        Simulated data — no live sensor is connected.
      </p>
      <button
        type="button"
        className="mt-[2px] cursor-pointer rounded-[999px]! border border-(--accent)/30 bg-transparent px-[14px] py-[7px] text-[12px]! text-(--accent) hover:bg-(--accent)/12"
        onClick={onClear}
      >
        Back to full body
      </button>
    </aside>
  );
}
