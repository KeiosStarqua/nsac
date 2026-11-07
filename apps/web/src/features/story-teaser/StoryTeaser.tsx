import { Link } from "@tanstack/react-router";
import { useCopy, useLocale } from "~/shared/i18n";
import { Section } from "~/shared/ui";
import styles from "./StoryTeaser.module.css";

export function StoryTeaser() {
  const copy = useCopy().storyTeaser;
  const locale = useLocale();
  return (
    <Section id="story" title={copy.title}>
      <div className={styles.card}>
        <div className={styles.dot} aria-hidden="true" />
        <p>{copy.lead}</p>
        <Link to="/story" search={{ lang: locale }} className={styles.cta}>
          {copy.cta}
        </Link>
      </div>
    </Section>
  );
}
