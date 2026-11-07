import type { ReactNode } from "react";
import styles from "./Section.module.css";

interface SectionProps {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}

/** Page section with a heading wired to the landmark, so screen readers can jump between sections. */
export function Section({ id, title, lead, children }: SectionProps) {
  const headingId = `${id}-title`;
  return (
    <section id={id} className={styles.section} aria-labelledby={headingId}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 id={headingId} className={styles.title}>
            {title}
          </h2>
          {lead ? <p className={styles.lead}>{lead}</p> : null}
        </header>
        {children}
      </div>
    </section>
  );
}
