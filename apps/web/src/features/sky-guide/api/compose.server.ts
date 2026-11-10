// Server-only: imported only from compose.functions.ts handlers. The marker import makes the build fail
// loudly if this file ever ends up in the client bundle.
import "@tanstack/react-start/server-only";
import { getCopy, type Locale } from "~/shared/i18n";
import { FACT_IDS, STATION_FACTS, type StationId } from "~/shared/sky";
import { skyLibrary } from "../catalog/library";
import { MAX_PROGRAM_CHARS } from "../model/program";

/** What the browser receives while a panel is composed. */
export type ComposeEvent =
  | { readonly kind: "chunk"; readonly text: string }
  | { readonly kind: "end" }
  /** No usable stream: Ollama is not running, the model is missing, or the stream broke. */
  | { readonly kind: "unavailable" };

// Local Ollama only (root AGENTS.md: fully offline). Set OLLAMA_MODEL to the tag pulled on the demo
// laptop; the default is the smaller model from the project's tech stack.
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3.5:9b";
/** Whole request, first byte to last. A panel that takes longer than this is not worth the wait. */
const TIMEOUT_MS = 45_000;

function systemPrompt(station: StationId, locale: Locale): string {
  const copy = getCopy(locale);
  const allowed = STATION_FACTS[station];
  const language = locale === "vi" ? "Vietnamese" : "English";

  return skyLibrary.prompt({
    preamble: [
      "You are Sky, an offline clinical assistant that flies beside astronauts and flight surgeons.",
      "You just landed on one part of a website and compose a small panel about it in OpenUI Lang.",
      "Output only the OpenUI Lang program: no Markdown, no code fences, no commentary.",
    ].join(" "),
    additionalRules: [
      `Write every text in ${language}. Speak as Sky, in the first person, warm and brief.`,
      "Never write a digit in any text. Numbers reach the panel only through Fact.",
      allowed.length > 0
        ? `Fact ids allowed here: ${allowed.join(", ")}. Never use the others (${FACT_IDS.filter((id) => !allowed.includes(id)).join(", ")}).`
        : "Do not use Fact here.",
      "Do not diagnose, do not give medical advice, and do not invent actions. The crew confirms every action.",
      "Use two to five children in SkyCard.",
    ],
    examples: [copy.sky.stations[station].preset],
  });
}

interface OllamaChunk {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}

/** Streams the local model's OpenUI Lang for one station, or a single `unavailable`. */
export async function* composeStation(station: StationId, locale: Locale): AsyncGenerator<ComposeEvent> {
  let response: Response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: true,
        think: false,
        options: { temperature: 0.4 },
        messages: [
          { role: "system", content: systemPrompt(station, locale) },
          { role: "user", content: getCopy(locale).sky.stations[station].brief },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    yield { kind: "unavailable" };
    return;
  }
  if (!response.ok || !response.body) {
    yield { kind: "unavailable" };
    return;
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffered += value;
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as OllamaChunk;
        if (chunk.error) throw new Error(chunk.error);
        const text = chunk.message?.content ?? "";
        if (text) {
          total += text.length;
          // A runaway answer is cut off; the browser's review then rejects it.
          if (total > MAX_PROGRAM_CHARS * 2) throw new Error("too long");
          yield { kind: "chunk", text };
        }
        if (chunk.done) {
          yield { kind: "end" };
          return;
        }
      }
    }
    yield { kind: "end" };
  } catch {
    yield { kind: "unavailable" };
  } finally {
    reader.cancel().catch(() => undefined);
  }
}
