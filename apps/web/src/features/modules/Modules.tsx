import { useCopy } from "~/shared/i18n";
import { SOURCES } from "~/shared/sources";
import { ExternalLink, Section } from "~/shared/ui";
import styles from "./Modules.module.css";

export function Modules() {
  const copy = useCopy();
  const m = copy.modules;
  return (
    <Section id="modules" title={m.title} lead={m.lead}>
      <ul className={styles.grid}>
        {m.working.map((item) => (
          <li key={item.name} className={styles.card}>
            <span className={styles.status}>{m.workingLabel}</span>
            <h3>{item.name}</h3>
            <p>{item.body}</p>
            {item.source ? (
              <p className={styles.source}>
                <ExternalLink href={SOURCES[item.source].url}>{copy.sources.items[item.source].label}</ExternalLink>
              </p>
            ) : null}
          </li>
        ))}
        {m.stubs.map((item) => (
          <li key={item.name} className={`${styles.card} ${styles.stub}`}>
            <span className={styles.status}>{m.stubLabel}</span>
            <h3>{item.name}</h3>
            <p>{item.body}</p>
          </li>
        ))}
      </ul>

      <div className={styles.landing}>
        <span className={styles.status}>{m.plannedLabel}</span>
        <div>
          <h3>{m.landingTitle}</h3>
          <p>{m.landingBody}</p>
        </div>
      </div>
    </Section>
  );
}
