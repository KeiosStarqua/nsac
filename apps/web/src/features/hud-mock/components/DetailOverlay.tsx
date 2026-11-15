import type { RefObject } from "react";
import {
  DETAIL_ACTION,
  DETAIL_CLOSE,
  DETAIL_EYEBROW,
  DETAIL_FOOTER,
  DETAIL_GLASS,
  DETAIL_MESSAGE,
  DETAIL_OVERLAY,
  DETAIL_VALUE,
} from "~/features/sky-hud/hud-classes";

export interface DetailDialogProps {
  readonly title: string;
  readonly value?: string;
  readonly message: string;
  readonly eyebrow: string;
  readonly footer: string;
  readonly action?: { readonly label: string; readonly onClick: () => void };
}

export interface DetailOverlayProps {
  readonly detail: DetailDialogProps;
  readonly closeLabel: string;
  readonly onClose: () => void;
  /** Focus target for the dialog (the host moves focus inside on open). */
  readonly dialogRef?: RefObject<HTMLElement | null>;
}

/** The console's detail dialog: one glass card over a dismissable backdrop. */
export function DetailOverlay({ detail, closeLabel, onClose, dialogRef }: DetailOverlayProps) {
  return (
    <div
      className={DETAIL_OVERLAY}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="detailTitle"
        className={DETAIL_GLASS}
        tabIndex={-1}
        ref={dialogRef as RefObject<HTMLElement>}
      >
        <button type="button" className={DETAIL_CLOSE} aria-label={closeLabel} onClick={onClose}>
          ×
        </button>
        <div className={DETAIL_EYEBROW}>{detail.eyebrow}</div>
        <h2 id="detailTitle">{detail.title}</h2>
        {detail.value ? <p className={DETAIL_VALUE}>{detail.value}</p> : null}
        <p className={DETAIL_MESSAGE}>{detail.message}</p>
        {detail.action ? (
          <button type="button" className={DETAIL_ACTION} onClick={detail.action.onClick}>
            {detail.action.label}
          </button>
        ) : null}
        <p className={DETAIL_FOOTER}>{detail.footer}</p>
      </section>
    </div>
  );
}
