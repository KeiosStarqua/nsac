import { createServerFn } from "@tanstack/react-start";
import type { Story } from "../model/parseStory";
import { loadStory } from "./story.server";

export const getStory = createServerFn({ method: "GET" }).handler(async (): Promise<Story> => loadStory());
