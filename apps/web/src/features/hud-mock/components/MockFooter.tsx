import { FOOTER, FOOTER_NOTE, SIMULATED_CHIP } from "../mock-classes";

export interface MockFooterProps {
  /** The AI disclaimer (`copy.chat.footer` in both locales). */
  readonly note: string;
  /** The `SIMULATED CREW DATA (P0)` chip at the bottom right. */
  readonly chip: string;
}

/** The console footer: one disclaimer line and the simulated-data chip. */
export function MockFooter({ note, chip }: MockFooterProps) {
  return (
    <footer className={FOOTER}>
      <p className={FOOTER_NOTE}>{note}</p>
      <span className={SIMULATED_CHIP} data-testid="simulated-crew-chip">
        {chip}
      </span>
    </footer>
  );
}
