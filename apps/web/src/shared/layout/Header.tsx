import { Link } from "@tanstack/react-router";
import { LOCALES, useCopy, useLocale } from "../i18n";
import styles from "./layout.module.css";

export function Header() {
  const copy = useCopy();
  const locale = useLocale();

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} to="/" search={{ lang: locale }} aria-label="Onboard Doctor">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Onboard Doctor</span>
        </Link>
        <nav aria-label="Primary" className={styles.nav}>
          <Link to="/" hash="concept" search={{ lang: locale }}>
            {copy.nav.concept}
          </Link>
          <Link to="/demo" search={{ lang: locale }} activeProps={{ "aria-current": "page" }}>
            {copy.nav.demo}
          </Link>
          <Link to="/story" search={{ lang: locale }} activeProps={{ "aria-current": "page" }}>
            {copy.nav.story}
          </Link>
          <Link to="/" hash="modules" search={{ lang: locale }}>
            {copy.nav.modules}
          </Link>
          <Link to="/" hash="trust" search={{ lang: locale }}>
            {copy.nav.trust}
          </Link>
          <Link to="/" hash="sources" search={{ lang: locale }}>
            {copy.nav.sources}
          </Link>
        </nav>
        <div className={styles.lang} role="group" aria-label={copy.nav.language}>
          {LOCALES.map((id) => (
            <Link
              key={id}
              to="."
              search={(prev) => ({ ...prev, lang: id })}
              replace
              resetScroll={false}
              aria-current={locale === id ? "true" : undefined}
            >
              {id.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
