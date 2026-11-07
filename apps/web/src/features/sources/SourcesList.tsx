import { useCopy } from "~/shared/i18n";
import { SOURCE_IDS, SOURCES } from "~/shared/sources";
import { ExternalLink, Section } from "~/shared/ui";
import styles from "./SourcesList.module.css";

export function SourcesList() {
  const copy = useCopy().sources;
  return (
    <Section id="sources" title={copy.title} lead={copy.lead}>
      <ul className={styles.list}>
        {SOURCE_IDS.map((id) => {
          const source = SOURCES[id];
          const item = copy.items[id];
          return (
            <li key={id}>
              <ExternalLink href={source.url}>{item.label}</ExternalLink>
              <span className={styles.note}>{item.note}</span>
              <span className={styles.checked}>
                {source.checked ? `${copy.checkedLabel} ${source.checked}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
