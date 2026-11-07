import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./Prose.module.css";

// Blockquotes in STORY.md are what Sky shows on screen, so they render as a "Sky screen" card.
const components: Components = {
  blockquote: ({ children }) => <aside className={styles.screen}>{children}</aside>,
  table: ({ children }) => (
    <div className={styles.tableWrap}>
      <table>{children}</table>
    </div>
  ),
};

/** Renders trusted repo Markdown. Raw HTML is not enabled, so the file cannot inject markup. */
export function Prose({ markdown }: { markdown: string }) {
  return (
    <div className={styles.prose}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}
