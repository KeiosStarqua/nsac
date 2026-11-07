import { Link } from "@tanstack/react-router";
import { useCopy, useLocale } from "~/shared/i18n";
import styles from "./Hero.module.css";

export function Hero() {
  const copy = useCopy().hero;
  const locale = useLocale();
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 id="hero-title">{copy.title}</h1>
        <p className={styles.lead}>{copy.lead}</p>
        <div className={styles.actions}>
          <Link to="/demo" search={{ lang: locale }} className={styles.primary}>
            {copy.primaryCta}
          </Link>
          <Link to="/" hash="features" search={{ lang: locale }} className={styles.secondary}>
            {copy.secondaryCta}
          </Link>
        </div>
        <ul className={styles.badges}>
          {copy.badges.map((badge) => (
            <li key={badge}>{badge}</li>
          ))}
        </ul>
        <p className={styles.challenge}>{copy.challenge}</p>
      </div>
    </section>
  );
}
