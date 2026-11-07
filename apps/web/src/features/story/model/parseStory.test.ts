import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStory } from "./parseStory";

const SAMPLE = `# Title

> A note
> on two lines

## 1. First

Body one.

---

## 2. Second

\`\`\`
## not a heading
\`\`\`

---

## Product map

| a | b |
`;

describe("parseStory", () => {
  const story = parseStory(SAMPLE);

  it("reads the title and joins the note", () => {
    expect(story.title).toBe("Title");
    expect(story.note).toBe("A note on two lines");
  });

  it("numbers chapters and strips separators", () => {
    expect(story.chapters.map((c) => [c.id, c.number, c.title])).toEqual([
      ["chapter-1", 1, "First"],
      ["chapter-2", 2, "Second"],
    ]);
    expect(story.chapters[0]!.markdown).toBe("Body one.");
  });

  it("does not split on headings inside code fences", () => {
    expect(story.chapters[1]!.markdown).toContain("## not a heading");
  });

  it("treats the unnumbered section as the product map", () => {
    expect(story.productMap).toMatchObject({ id: "product-map", number: null, title: "Product map" });
  });

  it("handles CRLF input", () => {
    expect(parseStory(SAMPLE.replace(/\n/g, "\r\n")).chapters).toHaveLength(2);
  });
});

describe("repo-root STORY.md", () => {
  const source = readFileSync(new URL("../../../../../../STORY.md", import.meta.url), "utf-8");
  const story = parseStory(source);

  it("keeps the structure the page depends on", () => {
    expect(story.title).not.toBe("");
    expect(story.note).not.toBe("");
    expect(story.chapters.length).toBeGreaterThanOrEqual(1);
    expect(story.chapters.map((c) => c.number)).toEqual(story.chapters.map((_, i) => i + 1));
    expect(story.chapters.every((c) => c.markdown.length > 0)).toBe(true);
    expect(story.productMap?.markdown).toContain("|");
  });
});
