import { useCopy } from "~/shared/i18n";
import { SOURCES } from "~/shared/sources";
import { ExternalLink, Section } from "~/shared/ui";
import styles from "./Earth.module.css";

export function Earth() {
  const copy = useCopy().earth;
  return (
    <Section id="earth" title={copy.title} lead={copy.lead}>
      <div className={styles.card}>
        <p>{copy.body}</p>
        <p className={styles.source}>
          <ExternalLink href={SOURCES.bedRest.url}>{copy.sourceLabel}</ExternalLink>
        </p>
      </div>
    </Section>
  );
}
