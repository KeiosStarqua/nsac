import { useCopy } from "~/shared/i18n";
import { SOURCES } from "~/shared/sources";
import { ExternalLink, Section } from "~/shared/ui";
import styles from "./Hazards.module.css";

export function Hazards() {
  const copy = useCopy();
  const h = copy.hazards;
  return (
    <Section id="hazards" title={h.title} lead={h.lead}>
      <ol className={styles.list}>
        {h.items.map((item, index) => (
          <li key={item.name} className={styles.item}>
            <div className={styles.summary}>
              <div className={styles.head}>
                <span className={styles.index} aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{item.name}</h3>
              </div>
              <p className={styles.body}>{item.body}</p>
            </div>
            <div className={styles.details}>
            {item.risks.length > 0 ? (
              <div className={styles.group}>
                <h4>{h.risksLabel}</h4>
                <ul>
                  {item.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {item.measured.length > 0 ? (
              <div className={styles.group}>
                <h4>{h.measuredLabel}</h4>
                <ul className={styles.tools}>
                  {item.measured.map((tool) => (
                    <li key={tool}>{tool}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className={styles.source}>
        <ExternalLink href={SOURCES.fiveHazards.url}>{copy.sources.items.fiveHazards.label}</ExternalLink>
      </p>
    </Section>
  );
}
