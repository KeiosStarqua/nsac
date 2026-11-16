import { FOOTER, FOOTER_NOTE } from "../mock-classes";

export interface MockFooterProps {
  /** The AI disclaimer (`copy.chat.footer` in both locales). */
  readonly note: string;
}

/** The console footer: one disclaimer line. */
export function MockFooter({ note }: MockFooterProps) {
  return (
    <footer className={FOOTER}>
      <p className={FOOTER_NOTE}>{note}</p>
    </footer>
  );
}
