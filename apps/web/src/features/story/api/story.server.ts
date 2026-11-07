// Server-only. STORY.md at the repo root is the single source of the story. `?raw` inlines it into the
// server bundle at build time, so production needs no file-system access and no network.
import "@tanstack/react-start/server-only";
import storySource from "../../../../../../STORY.md?raw";
import { parseStory, type Story } from "../model/parseStory";

export function loadStory(): Story {
  return parseStory(storySource);
}
