import { Link } from "@tanstack/react-router";
import { useCopy, useLocale } from "~/shared/i18n";
import type { Story } from "../model/parseStory";
import { Prose } from "./Prose";
import styles from "./StoryReader.module.css";

export function StoryReader({ story }: { story: Story }) {
  const copy = useCopy();
  const locale = useLocale();
  const toc = [...story.chapters, ...(story.productMap ? [story.productMap] : [])];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{copy.story.eyebrow}</p>
        {/* The story text is Vietnamese by design, whatever the page language. */}
        <h1 lang="vi">{story.title}</h1>
        <p className={styles.note} lang="vi">
          {story.note}
        </p>
        {locale === "en" ? <p className={styles.langNote}>{copy.story.languageNote}</p> : null}
      </header>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label={copy.story.tocTitle}>
          <h2>{copy.story.tocTitle}</h2>
          <ol>
            {toc.map((chapter) => (
              <li key={chapter.id}>
                <Link to="/story" hash={chapter.id} search={{ lang: locale }} lang="vi">
                  {chapter.number ? <span className={styles.num}>{chapter.number}</span> : null}
                  {chapter.title}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <article className={styles.article} lang="vi">
          {story.chapters.map((chapter) => (
            <section key={chapter.id} id={chapter.id} aria-labelledby={`${chapter.id}-title`} className={styles.chapter}>
              <h2 id={`${chapter.id}-title`}>
                <span className={styles.badge} aria-hidden="true">
                  {chapter.number}
                </span>
                {chapter.title}
              </h2>
              <Prose markdown={chapter.markdown} />
            </section>
          ))}

          {story.productMap ? (
            <section id={story.productMap.id} aria-labelledby="product-map-title" className={styles.chapter}>
              <h2 id="product-map-title">{story.productMap.title}</h2>
              <Prose markdown={story.productMap.markdown} />
            </section>
          ) : null}

          <aside className={styles.next} lang={locale}>
            <h2>{copy.story.next.title}</h2>
            <p>{copy.story.next.body}</p>
            <Link to="/demo" search={{ lang: locale }} className={styles.cta}>
              {copy.story.next.cta}
            </Link>
          </aside>
        </article>
      </div>
    </div>
  );
}
