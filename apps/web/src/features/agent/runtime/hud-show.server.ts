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
  "Update what the astronaut sees on screen with a health visualization.",
  "Call ONLY when the user asks to see/show/visualize metrics, trends or what appears on the display.",
  "brief is one short sentence saying what to show (e.g. 'Show resting heart rate and sleep for this week').",
  "Call at most once per turn. Never call for pure conversation.",
].join(" ");

/** The `brief` contract shared by both cores' tool definitions (one description, two wire formats). */
export const SHOW_HUD_DESCRIPTION = DESCRIPTION;
export const SHOW_HUD_BRIEF_MAX_CHARS = 500;

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
  /**
   * The turn's own abort budget. A cancelled turn (the astronaut closed the chat / reloaded) stops
   * the delegated composition with it instead of running on to its own 30 s budget unwatched.
   */
  signal?: AbortSignal;
};

/**
 * Core-agnostic body of `show_on_hud`: validate the brief, delegate composition, run the catalog
 * review, hand back either the reviewed program or the model-facing failure text. Both the pi tool
 * (below) and the Mastra tool (`features/agent/mastra/mastra-core.server.ts`) call exactly this, so
 * the validation gate can never drift between the two cores.
 */
export async function composeHudProgramForBrief(
  rawBrief: unknown,
  opts: ShowHudOptions = {},
): Promise<{ ok: true; program: string } | { ok: false; message: string }> {
  const raw = typeof rawBrief === "string" ? rawBrief.slice(0, SHOW_HUD_BRIEF_MAX_CHARS) : "";
  const brief = raw.trim();
  if (!brief) return { ok: false, message: "brief is required: one short sentence describing what to visualize." };
  const compose =
    opts.compose ??
    (async (text: string): Promise<string> => {
      const res = await runAgent(
        "sky-generative-ui",
        text,
        {
          request: text,
          surface: "SKY HUD",
          allowList: HUD_COMPONENT_NAMES,
          maxChars: MAX_PROGRAM_CHARS,
        },
        // Cancelled turn (the astronaut closed the chat / reloaded): the delegated generation stops
        // with it instead of running on to its own 30 s budget unwatched.
        { signal: opts.signal },
      );
      if (res.status !== "ok") throw new Error(res.status);
      return res.text;
    });
  try {
    const rawProgram = await compose(brief);
    const program = extractProgram(rawProgram);
    const review = reviewProgram(
      program,
      { allowList: HUD_COMPONENT_NAMES, maxChars: MAX_PROGRAM_CHARS },
      parseHudProgram,
    );
    if (!review.ok) {
      // Programs carry no digits and no free prose values (Fact ids only), so the head is safe to log.
      console.warn(
        "show_on_hud: catalog review rejected",
        review.reasons.join("; "),
        program.slice(0, 400),
      );
      return {
        ok: false,
        message: `HUD update rejected by catalog review (${review.reasons[0] ?? "unknown"}). Reply without changing the display.`,
      };
    }
    return { ok: true, program: review.program };
  } catch (cause) {
    const msg = (cause as Error)?.message?.slice(0, 120) ?? "compose_failed";
    console.warn("show_on_hud: delegate failed", msg);
    return { ok: false, message: `Could not update the HUD (${msg}). Reply without changing the display.` };
  }
}

/**
 * The one purpose-built tool of `sky-chat`. On success the validated program lands in
 * `artifacts.hudProgram`; `astro-chat.server.ts` hands it to the SSE route as one `ui` frame after the
 * reply, and the gen HUD swaps its OpenUI tree. On any failure it returns an error result and the
 * HUD is untouched.
 */
export function createShowHudTool(artifacts: TurnArtifacts, opts: ShowHudOptions = {}): ToolDefinition {
  return {
    name: "show_on_hud",
    label: "Show on HUD",
    description: DESCRIPTION,
    promptSnippet: "show_on_hud(brief) — put the health visualization the user asked for on screen",
    promptGuidelines: [
      "Call show_on_hud at most once per turn and only on explicit user request to visualize health data",
      "brief: one sentence, no digits the display cannot render",
    ],
    parameters: PARAMETERS as unknown as ToolDefinition["parameters"],
    executionMode: "sequential",
    async execute(_toolCallId: string, params: any): Promise<ToolResult> {
      const outcome = await composeHudProgramForBrief(params?.brief, { ...opts, signal: artifacts.signal });
      if (!outcome.ok) return err(outcome.message);
      artifacts.hudProgram = outcome.program;
      return {
        content: [{ type: "text", text: "HUD updated." }],
        details: { program: outcome.program },
        isError: false,
      };
    },
  };
}
