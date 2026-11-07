// Pure parser for the repo-root STORY.md. STORY.md is the single source of the story; this file only
// splits it into chapters so the page can build a table of contents.
// Contract it relies on: one `# ` title, optional leading `> ` note, `## N. Title` chapters, and any
// unnumbered `## ` section (today "Gắn với sản phẩm") treated as the product map.

export interface StoryChapter {
  /** Anchor id: `chapter-<n>` for numbered chapters, `product-map` for the unnumbered one. */
  readonly id: string;
  readonly number: number | null;
  readonly title: string;
  readonly markdown: string;
}

export interface Story {
  readonly title: string;
  /** The fiction note under the title, without the leading `> `. */
  readonly note: string;
  readonly chapters: readonly StoryChapter[];
  readonly productMap: StoryChapter | null;
}

const NUMBERED = /^(\d+)\.\s+(.+)$/;

export function parseStory(source: string): Story {
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  let title = "";
  const noteLines: string[] = [];
  const sections: { heading: string; body: string[] }[] = [];
  let inFence = false;

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;

    const current = sections.at(-1);
    if (!inFence && line.startsWith("## ")) {
      sections.push({ heading: line.slice(3).trim(), body: [] });
    } else if (!inFence && !current && line.startsWith("# ")) {
      title = line.slice(2).trim();
    } else if (current) {
      current.body.push(line);
    } else if (line.startsWith(">")) {
      noteLines.push(line.replace(/^>\s?/, ""));
    }
  }

  const chapters: StoryChapter[] = [];
  let productMap: StoryChapter | null = null;

  for (const { heading, body } of sections) {
    const markdown = trimRules(body).join("\n").trim();
    const match = NUMBERED.exec(heading);
    if (match) {
      const number = Number(match[1]);
      chapters.push({ id: `chapter-${number}`, number, title: match[2]!.trim(), markdown });
    } else {
      productMap = { id: "product-map", number: null, title: heading, markdown };
    }
  }

  return { title, note: noteLines.join(" ").trim(), chapters, productMap };
}

/** Drops the `---` separators that sit between chapters, so they do not render as stray rules. */
function trimRules(lines: string[]): string[] {
  const out = [...lines];
  while (out.length && (out.at(-1)!.trim() === "" || out.at(-1)!.trim() === "---")) out.pop();
  return out;
}
