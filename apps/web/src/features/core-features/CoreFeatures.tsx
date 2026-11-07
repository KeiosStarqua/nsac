import { useCopy } from "~/shared/i18n";
import { Section } from "~/shared/ui";
import styles from "./CoreFeatures.module.css";

export function CoreFeatures() {
  const copy = useCopy().features;
  return (
    <Section id="features" title={copy.title} lead={copy.lead}>
      <ul className={styles.grid}>
        {copy.items.map((item) => (
          <li key={item.name} className={styles.card}>
            <span className={styles.audience}>{item.audience}</span>
            <h3>{item.name}</h3>
            <p>{item.body}</p>
            <div className={styles.example}>
              <strong>{copy.exampleLabel}</strong>
              <p>{item.example}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
