// Server-only: the `show_on_hud` tool of the `sky-chat` session. The talking agent never composes a
// program itself — it delegates to the `sky-generative-ui` agent and ships only what survives the
// same `reviewProgram` gate the HUD composer uses. Presentation only: nothing here actions anything.
import "@tanstack/react-start/server-only";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { HUD_COMPONENT_NAMES } from "~/features/hud-gen/model/names";
import { extractProgram, MAX_PROGRAM_CHARS, reviewProgram } from "~/features/hud-gen/model/review";
import { parseHudProgram } from "~/features/hud-gen/catalog";
import { runAgent } from "./run.server";
import type { TurnArtifacts } from "./pi.server";

const DESCRIPTION = [
  "Update the Sky HUD with a health visualization.",
  "Call ONLY when the user asks to see/show/visualize metrics, trends or panels on screen.",
  "brief is one short sentence saying what to show (e.g. 'Show resting heart rate and sleep for this week').",
  "Call at most once per turn. Never call for pure conversation.",
].join(" ");

// Plain JSON Schema, on purpose: pi-ai's `validateToolArguments` compiles tool parameters with
// `@earendil-works/pi-schema` (`coerce: true`) and accepts any JSON Schema, so no typebox dependency
// (and no `bun.lock` change, which would invalidate the nix FOD hash) is needed.
const PARAMETERS = {
  type: "object",
  properties: {
    brief: {
      type: "string",
      minLength: 1,
      maxLength: 500,
      description: "One short sentence describing what to visualize.",
    },
  },
  required: ["brief"],
  additionalProperties: false,
};

type ToolResult = Awaited<ReturnType<ToolDefinition["execute"]>>;

/** A model-facing failure: the turn continues, the HUD stays as it was. */
function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], details: {}, isError: true };
}

export type ShowHudOptions = {
  /** Test seam: produce the raw program for a brief instead of delegating to `sky-generative-ui`. */
  compose?: (brief: string) => Promise<string>;
};

/**
 * The one purpose-built tool of `sky-chat`. On success the validated program lands in
 * `artifacts.hudProgram`; `astro-chat.server.ts` hands it to the SSE route as one `ui` frame after the
 * reply, and the gen HUD swaps its OpenUI tree. On any failure it returns an error result and the
 * HUD is untouched.
 */
export function createShowHudTool(artifacts: TurnArtifacts, opts: ShowHudOptions = {}): ToolDefinition {
  const compose =
    opts.compose ??
    (async (brief: string): Promise<string> => {
      const res = await runAgent("sky-generative-ui", brief, {
        request: brief,
        surface: "SKY HUD",
        allowList: HUD_COMPONENT_NAMES,
        maxChars: MAX_PROGRAM_CHARS,
      });
      if (res.status !== "ok") throw new Error(res.status);
      return res.text;
    });

  return {
    name: "show_on_hud",
    label: "Show on HUD",
    description: DESCRIPTION,
    promptSnippet: "show_on_hud(brief) — refresh the HUD with a health visualization the user asked for",
    promptGuidelines: [
      "Call show_on_hud at most once per turn and only on explicit user request to visualize health data",
      "brief: one sentence, no digits the HUD cannot render",
    ],
    parameters: PARAMETERS as unknown as ToolDefinition["parameters"],
    executionMode: "sequential",
    async execute(_toolCallId: string, params: any): Promise<ToolResult> {
      const raw = typeof params?.brief === "string" ? params.brief.slice(0, 500) : "";
      const brief = raw.trim();
      if (!brief) return err("brief is required: one short sentence describing what to visualize.");
      try {
        const rawProgram = await compose(brief);
        const program = extractProgram(rawProgram);
        const review = reviewProgram(
          program,
          { allowList: HUD_COMPONENT_NAMES, maxChars: MAX_PROGRAM_CHARS },
          parseHudProgram,
        );
        if (!review.ok) {
          console.warn("show_on_hud: catalog review rejected", review.reasons.join("; "));
          return err(
            `HUD update rejected by catalog review (${review.reasons[0] ?? "unknown"}). Reply without changing the display.`,
          );
        }
        artifacts.hudProgram = review.program;
        return { content: [{ type: "text", text: "HUD updated." }], details: { program: review.program }, isError: false };
      } catch (cause) {
        const msg = (cause as Error)?.message?.slice(0, 120) ?? "compose_failed";
        console.warn("show_on_hud: delegate failed", msg);
        return err(`Could not update the HUD (${msg}). Reply without changing the display.`);
      }
    },
  };
}
