import { useCopy } from "~/shared/i18n";
import { Section } from "~/shared/ui";
import styles from "./Pipeline.module.css";

export function Pipeline() {
  const copy = useCopy().pipeline;
  return (
    <Section id="how" title={copy.title} lead={copy.lead}>
      <ol className={styles.steps}>
        {copy.steps.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.index} aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <span className={styles.tag}>{step.tag}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}
