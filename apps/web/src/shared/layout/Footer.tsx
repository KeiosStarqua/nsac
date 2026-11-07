import { useCopy } from "../i18n";
import styles from "./layout.module.css";

export function Footer() {
  const copy = useCopy();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <p>{copy.footer.line}</p>
        <p>{copy.footer.synthetic}</p>
        <p>
          <strong>{copy.trust.disclaimer}</strong> · {copy.footer.license}
        </p>
      </div>
    </footer>
  );
}
