import { useEffect, useState, type CSSProperties } from "react";
import { treeBySystem } from "../model/tree";

export interface BodyTreeProps {
  readonly open: boolean;
  readonly onToggle: () => void;
  /** The canvas's own selection (same state the scene eases the camera to). */
  readonly selected: string | null;
  readonly onSelect: (key: string) => void;
}

const GROUPS = treeBySystem();

function ListIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="2.6" cy="4.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="2.6" cy="9" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="2.6" cy="13.5" r="0.6" fill="currentColor" stroke="none" />
      <line x1="6.5" y1="4.5" x2="15.5" y2="4.5" />
      <line x1="6.5" y1="9" x2="15.5" y2="9" />
      <line x1="6.5" y1="13.5" x2="15.5" y2="13.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="13.5" y1="4.5" x2="4.5" y2="13.5" />
      <line x1="4.5" y1="4.5" x2="13.5" y2="13.5" />
    </svg>
  );
}

// Small round icon button shared by the closed-state toggle and the drawer's
// close button. Rounded radius keeps the unlayered `:focus-visible` reset
// from flattening the circle.
const ROUND_BUTTON =
  "flex size-[44px] cursor-pointer items-center justify-center rounded-[999px]! border border-(--accent)/32 bg-(--surface)/62 text-(--muted) backdrop-blur-[6px] transition-[border-color,color,background-color] duration-200 ease-[ease] hover:border-(--accent) hover:text-(--text) motion-reduce:transition-none";

/**
 * The accessible text twin of the 3D atlas (DESIGN.md §15.2), page variant
 * only: closed, it renders just a toggle on the left edge; open, a drawer
 * with every catalog structure grouped by system, selectable by keyboard and
 * screen reader. Selection is the canvas's own `selected` key — clicking a
 * row eases the camera exactly like a 3D pick; the tree holds no selection
 * state of its own. Copy is fixed English (the page does not translate).
 *
 * The drawer slides in on `transform` alone; it does not animate under
 * `prefers-reduced-motion`.
 */
export function BodyTree({ open, onToggle, selected, onSelect }: BodyTreeProps) {
  // Mount-time slide-in: first paint at the off-screen transform, then the
  // resting one on the next frame — a transform-only transition.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        aria-label="Open body tree"
        className={`${ROUND_BUTTON} absolute top-1/2 left-[clamp(14px,2vw,28px)] z-20 -translate-y-1/2`}
      >
        <ListIcon />
      </button>
    );
  }

  return (
    <div
      className={`absolute inset-y-0 left-0 z-20 flex w-[min(82vw,300px)] flex-col border-r border-(--accent)/22 bg-(--surface)/85 backdrop-blur-[8px] transition-transform duration-200 ease-[ease] motion-reduce:transition-none ${entered ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex flex-none items-center justify-between gap-[12px] border-b border-(--accent)/14 px-[14px] pt-[12px] pb-[10px]">
        <h2 className="m-0 font-(family-name:--mono) text-[11px] font-medium tracking-[0.22em]! uppercase text-(--text)">
          Body Tree
        </h2>
        <button type="button" onClick={onToggle} aria-label="Close body tree" className={ROUND_BUTTON}>
          <CloseIcon />
        </button>
      </div>
      <nav
        aria-label="Body tree"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[12px] pt-[4px] pb-[14px]"
      >
        {GROUPS.map((group) => (
          <section key={group.system}>
            <h3 className="m-0 flex items-baseline justify-between gap-[8px] px-[4px] pt-[10px] pb-[4px] font-(family-name:--mono) text-[10px] font-medium tracking-[0.18em]! uppercase text-(--muted)">
              <span>{group.systemLabel}</span>
              <span className="text-[9px] tracking-[0.14em] text-(--muted) opacity-75">
                {group.items.length}
              </span>
            </h3>
            <ul className="m-0 flex list-none flex-col gap-[3px] p-0">
              {group.items.map((item) => {
                const active = item.key === selected;
                const style = { "--swatch": item.color } as CSSProperties;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(item.key)}
                      style={style}
                      className={`flex min-h-[44px] w-full cursor-pointer items-center gap-[8px] rounded-(--radius-sm)! border px-[8px] py-[6px] text-left transition-[border-color,background-color] duration-200 ease-[ease] motion-reduce:transition-none ${
                        active
                          ? "border-(--accent)/44 bg-(--accent)/12"
                          : "border-transparent bg-transparent hover:border-(--accent)/26 hover:bg-(--accent)/7"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="size-[7px] flex-none rounded-[50%] [background-color:var(--swatch,var(--accent))] [box-shadow:0_0_7px_color-mix(in_srgb,var(--swatch,var(--accent))_55%,transparent)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px]! leading-[1.35] text-(--text)">
                        {item.label}
                      </span>
                      <span className="min-w-0 max-w-[38%] flex-none truncate text-[10px] leading-[1.35] text-(--muted)">
                        {item.category}
                      </span>
                      {item.simulated ? (
                        <span
                          title="Simulated HUD reading"
                          className="flex-none rounded-[4px] border border-(--accent)/32 bg-(--accent)/8 px-[4px] py-[1px] font-(family-name:--mono) text-[8px] leading-[1.5] tracking-[0.14em] text-(--accent)"
                        >
                          <span aria-hidden="true">SIM</span>
                          <span className="sr-only">Simulated reading</span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  );
}
