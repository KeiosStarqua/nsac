import { ShieldCheck } from "@phosphor-icons/react";
import { useCopy } from "~/shared/i18n";
import { Section } from "~/shared/ui";
import styles from "./Trust.module.css";

export function Trust() {
  const copy = useCopy().trust;
  return (
    <Section id="trust" title={copy.title} lead={copy.lead}>
      <ul className={styles.grid}>
        {copy.items.map((item) => (
          <li key={item.title} className={styles.item}>
            <ShieldCheck aria-hidden="true" size={26} weight="duotone" />
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </li>
        ))}
      </ul>
      <p className={styles.disclaimer}>{copy.disclaimer}</p>
    </Section>
  );
}
