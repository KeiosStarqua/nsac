/**
 * The discrete way out of the fullscreen `/body` hologram: a kbd chip that
 * does exactly what the `Escape` key does (calls the same `onClose` through
 * `BodyMapOverlay`'s `close`). Hook-free on purpose so vitest can activate
 * the button without a DOM. Rendered only by the `page` variant, never by
 * the HUD overlay. Copy is fixed English — the demo does not translate it.
 *
 * Placement: desktop bottom-right (the attribution line owns bottom-left);
 * under 900px it flips to the top-right corner (the loading pill owns
 * top-left there, the attribution drops to 46px and the rail becomes a
 * bottom row). `z-10` like the rail and attribution; pointer-events stay
 * automatic so the chip is clickable.
 */
export interface EscapeChipProps {
  readonly onActivate: () => void;
}

export function EscapeChip({ onActivate }: EscapeChipProps) {
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label="Back to HUD (Escape)"
      className="absolute right-[14px] bottom-[10px] z-10 inline-flex cursor-pointer items-center gap-[7px] rounded-[999px]! border border-(--accent)/22 bg-(--surface)/62 py-[5px] pr-[12px] pl-[6px] text-[10px]! leading-none! tracking-[0.18em] text-(--muted) backdrop-blur-[6px] [text-shadow:0_1px_6px_rgba(0,0,0,0.9)] transition-colors duration-200 hover:border-(--accent)/44 hover:text-(--text) motion-reduce:transition-none max-[900px]:top-[12px] max-[900px]:right-[12px] max-[900px]:bottom-auto"
    >
      <kbd
        aria-hidden="true"
        className="rounded-[6px] border border-(--accent)/32 bg-(--bg)/70 px-[6px] py-[2px] font-(family-name:--mono) leading-none tracking-[0.08em] text-(--text)"
      >
        Esc
      </kbd>
      <span className="font-(family-name:--mono)">HUD</span>
    </button>
  );
}
