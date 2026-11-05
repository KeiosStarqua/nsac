import { createLibrary } from "@openuidev/react-lang";
import type { PromptOptions } from "@openuidev/react-lang";
import {
  Callout,
  ConfirmAction,
  CrewCard,
  Heading,
  Paragraph,
  Stack,
  StatTile,
  TrendChart,
} from "./components";

/** Compact on purpose: a small local model follows a short prompt better than the 36k built-in one. */
export const healthLibrary = createLibrary({
  root: "Stack",
  components: [Stack, Heading, Paragraph, StatTile, CrewCard, TrendChart, Callout, ConfirmAction],
  componentGroups: [
    { name: "Layout", components: ["Stack"] },
    { name: "Text", components: ["Heading", "Paragraph", "Callout"] },
    { name: "Health data", components: ["StatTile", "CrewCard", "TrendChart"] },
    { name: "Actions", components: ["ConfirmAction"] },
  ],
});

export const healthPromptOptions: PromptOptions = {
  preamble:
    "You are the ship health assistant for a fictional crew. You build a small dashboard that helps astronauts read the situation. You never decide alone: any action is only proposed with ConfirmAction.",
  additionalRules: [
    "Use only numbers returned by the tools. Never invent crew members, counts or days.",
    "At most one ConfirmAction per answer, and only when a tool result supports it.",
    "Keep it short: a Heading, 2 to 4 StatTile or CrewCard items, optionally one TrendChart or Callout.",
    "Plain text only inside strings. No markdown, no emoji.",
  ],
  examples: [
    `root = Stack([title, tiles, chart, step])
title = Heading("Day 8 flu status", "2")
tiles = Stack([sick, exposed], "row", "m")
sick = StatTile("Sick now", 3, "crew", "alert", "Up from 1 yesterday")
exposed = StatTile("Incubating", 2, "crew", "watch")
chart = TrendChart("Sick crew per day", [0, 0, 0, 1, 1, 2, 3, 3], ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"])
step = ConfirmAction("Isolate Elif", "Elif has symptoms and eats in the galley with two others.", "Confirm isolation", "quarantine:c5")`,
  ],
};
