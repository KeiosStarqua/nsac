import { Link } from "@tanstack/react-router";
import { LOCALES, useCopy, useLocale } from "../i18n";
import styles from "./layout.module.css";

export function Header() {
  const copy = useCopy();
  const locale = useLocale();

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} to="/" search={{ lang: locale }} aria-label="Sky">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Sky</span>
        </Link>
        <nav aria-label="Primary" className={styles.nav}>
          <Link to="/concept" hash="features" search={{ lang: locale }} activeOptions={{ includeHash: true }}>
            {copy.nav.features}
          </Link>
          <Link to="/concept" hash="hazards" search={{ lang: locale }} activeOptions={{ includeHash: true }}>
            {copy.nav.hazards}
          </Link>
          <Link to="/concept" hash="data" search={{ lang: locale }} activeOptions={{ includeHash: true }}>
            {copy.nav.data}
          </Link>
          <Link to="/concept" search={{ lang: locale }} activeProps={{ "aria-current": "page" }}>
            {copy.nav.concept}
          </Link>
          <Link to="/story" search={{ lang: locale }} activeProps={{ "aria-current": "page" }}>
            {copy.nav.story}
          </Link>
          <Link to="/concept" hash="trust" search={{ lang: locale }} activeOptions={{ includeHash: true }}>
            {copy.nav.trust}
          </Link>
          <Link to="/concept" hash="sources" search={{ lang: locale }} activeOptions={{ includeHash: true }}>
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
