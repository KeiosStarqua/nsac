import { useCopy } from "~/shared/i18n";
import { Section } from "~/shared/ui";
import styles from "./Difference.module.css";

export function Difference() {
  const copy = useCopy().difference;
  return (
    <Section id="concept" title={copy.title} lead={copy.lead}>
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">{copy.columns.label}</span>
              </th>
              <th scope="col">{copy.columns.dashboard}</th>
              <th scope="col" className={styles.ours}>
                {copy.columns.ours}
              </th>
            </tr>
          </thead>
          <tbody>
            {copy.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.dashboard}</td>
                <td className={styles.ours}>{row.ours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
