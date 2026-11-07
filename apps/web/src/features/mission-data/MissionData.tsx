import { Cpu, HandPointing } from "@phosphor-icons/react";
import { useCopy } from "~/shared/i18n";
import { SOURCES } from "~/shared/sources";
import { ExternalLink, Section } from "~/shared/ui";
import styles from "./MissionData.module.css";

export function MissionData() {
  const copy = useCopy();
  const d = copy.data;
  const icons = [Cpu, HandPointing];

  return (
    <Section id="data" title={d.title} lead={d.lead}>
      <h3 className={styles.subtitle}>{d.collectionTitle}</h3>
      <ul className={styles.collection}>
        {d.collection.map((item, index) => {
          const Icon = icons[index % icons.length]!;
          return (
            <li key={item.title}>
              <Icon aria-hidden="true" size={26} weight="duotone" />
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{d.columns.data}</th>
              <th scope="col">{d.columns.standard}</th>
              <th scope="col">{d.columns.context}</th>
              <th scope="col">{d.columns.requirement}</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((row) => (
              <tr key={`${row.data}-${row.context}`}>
                <th scope="row">{row.data}</th>
                <td className={styles.standard}>{row.standard}</td>
                <td>{row.context}</td>
                <td>
                  {row.requirement ? (
                    <ExternalLink href={SOURCES.nasaStd3001.url}>{row.requirement}</ExternalLink>
                  ) : (
                    "·"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>{d.note}</p>
    </Section>
  );
}
