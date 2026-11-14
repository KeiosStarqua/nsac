import type { Dispatch, SetStateAction } from "react";
import { SYSTEM_LABELS } from "open-anatomy-3d";
import { LAYER_KEYS, toggleLayer, type LayerMap } from "../model/layers";

export interface LayerRailProps {
  readonly layers: LayerMap;
  readonly setLayers: Dispatch<SetStateAction<LayerMap>>;
}

/**
 * One toggle per body system (all seven catalog systems, joints included).
 * The last visible layer cannot be switched off, so the hologram is never empty.
 */
export function LayerRail({ layers, setLayers }: LayerRailProps) {
  return (
    <section
      className="flex flex-col gap-[10px] rounded-(--radius) border border-(--accent)/18 bg-(--surface)/78 px-[14px] py-[16px] max-[900px]:p-[12px]"
      aria-label="Body systems"
    >
      <h3 className="m-0 text-[11px] font-medium tracking-[0.18em]! uppercase">Body systems</h3>
      <p className="m-0 text-[12px] leading-[1.55] text-(--muted)">
        Toggle what the hologram shows. At least one system stays on.
      </p>
      <ul className="m-0 flex list-none flex-col gap-[4px] p-0 max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:gap-[6px]">
        {LAYER_KEYS.map((key) => (
          <li key={key}>
            <button
              type="button"
              className="group flex w-full cursor-pointer items-center gap-[10px] rounded-(--radius-sm)! border border-transparent bg-transparent px-[10px] py-[8px] text-left text-[13px]! text-(--text) transition-[border-color,background-color,opacity] duration-200 ease-[ease] hover:border-(--accent)/26 hover:bg-(--accent)/7 data-[on=false]:text-(--muted) data-[on=false]:opacity-[0.62] max-[900px]:w-auto max-[900px]:rounded-[999px]! max-[900px]:border-(--accent)/18 max-[900px]:px-[12px] max-[900px]:py-[6px] max-[900px]:text-[12px]! motion-reduce:transition-none"
              aria-pressed={layers[key]}
              data-on={layers[key] ? "true" : "false"}
              onClick={() => setLayers((previous: LayerMap) => toggleLayer(previous, key))}
            >
              <span
                className="size-[7px] flex-none rounded-[50%] bg-(--muted) group-data-[on=true]:bg-(--accent) group-data-[on=true]:[box-shadow:0_0_8px_color-mix(in_srgb,var(--accent)_65%,transparent)]"
                aria-hidden="true"
              />
              {SYSTEM_LABELS[key]}
              <span className="ml-auto font-(family-name:--mono) text-[9px] tracking-[0.16em] uppercase text-(--muted) group-data-[on=true]:text-(--accent) max-[900px]:hidden">
                {layers[key] ? "on" : "off"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
