import { describe, expect, it } from "vitest";
import { createShowHudTool } from "./hud-show.server";
import { setSessionFactory } from "./run.server";
import { reviewProgram } from "~/features/hud-gen/model/review";
import { HUD_COMPONENT_NAMES } from "~/features/hud-gen/model/names";
import { parseHudProgram } from "~/features/hud-gen/catalog";

// A minimal program the HUD catalog accepts: one Surface, one Footer, no digits.
const VALID = `root = Surface([footer])
footer = Footer()`;

// Wrong root: reviewProgram rejects it before anything reaches the HUD.
const WRONG_ROOT = `root = Footer()`;

const brief = (params: unknown) => ({ brief: params });

/** `ToolDefinition.execute` takes (id, params, signal, onUpdate, ctx); tests only need the first two. */
const run = (tool: ReturnType<typeof createShowHudTool>, params: unknown) =>
  tool.execute("call-1", params as never, undefined, undefined, {} as never);

describe("show_on_hud tool", () => {
  it("stops the delegated generation when the turn is already cancelled", async () => {
    // No `compose` seam: this exercises the real delegation path (runAgent → sky-generative-ui)
    // through the session-factory seam, with the turn's own signal already aborted.
    let disposed = false;
    setSessionFactory(async () => ({
      prompt: (_text: string, promptOpts: { signal?: AbortSignal }) =>
        new Promise<string>((_resolve, reject) => {
          if (promptOpts.signal?.aborted) reject(new Error("timeout"));
          else promptOpts.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      dispose: () => {
        disposed = true;
      },
    }));

    const caller = new AbortController();
    caller.abort();
    const artifacts: { hudProgram?: string; signal?: AbortSignal } = { signal: caller.signal };
    const tool = createShowHudTool(artifacts as never);

    const result = await run(tool, brief("Show resting heart rate and sleep"));

    expect(result.isError).toBe(true);
    expect(disposed).toBe(true);
    expect(artifacts.hudProgram).toBeUndefined();
    expect(JSON.stringify(result.content)).toContain("Could not update the HUD");
    setSessionFactory(null);
  });

  it("stores the reviewed program in the turn artifacts and reports success to the model", async () => {
    const artifacts: { hudProgram?: string; chatDock?: "right" } = {};
    const tool = createShowHudTool(artifacts, { compose: async () => VALID });

    const result = await run(tool, brief("Show resting heart rate and sleep"));

    expect(result.isError).toBe(false);
    expect(artifacts.hudProgram).toBe(VALID);
    expect(artifacts.chatDock).toBe("right");
    expect(result.details).toEqual({ program: VALID });
    expect(JSON.stringify(result.content)).toContain("HUD updated");
  });

  it("strips fences from the delegate's reply before review", async () => {
    const artifacts: { hudProgram?: string; chatDock?: "right" } = {};
    const tool = createShowHudTool(artifacts, { compose: async () => "```openui\n" + VALID + "\n```" });

    const result = await run(tool, brief("Show the vitals"));

    expect(result.isError).toBe(false);
    expect(artifacts.hudProgram).toBe(VALID);
    expect(artifacts.chatDock).toBe("right");
  });

  it("rejects a program the catalog refuses and leaves the HUD untouched", async () => {
    const artifacts: { hudProgram?: string; chatDock?: "right" } = {};
    const tool = createShowHudTool(artifacts, { compose: async () => WRONG_ROOT });

    const result = await run(tool, brief("Show the vitals"));

    expect(result.isError).toBe(true);
    expect(artifacts.hudProgram).toBeUndefined();
    expect(artifacts.chatDock).toBeUndefined();
    expect(JSON.stringify(result.content)).toContain("rejected by catalog review");
    // Sanity: the fixture really is invalid under the same gate the tool uses.
    expect(reviewProgram(WRONG_ROOT, { allowList: HUD_COMPONENT_NAMES }, parseHudProgram).ok).toBe(false);
  });

  it("returns an error result when the delegate throws", async () => {
    const artifacts: { hudProgram?: string } = {};
    const tool = createShowHudTool(artifacts, {
      compose: async () => {
        throw new Error("unavailable");
      },
    });

    const result = await run(tool, brief("Show the vitals"));

    expect(result.isError).toBe(true);
    expect(artifacts.hudProgram).toBeUndefined();
    expect(JSON.stringify(result.content)).toContain("Could not update the HUD");
  });

  it("refuses an empty brief without calling the delegate", async () => {
    let calls = 0;
    const artifacts: { hudProgram?: string } = {};
    const tool = createShowHudTool(artifacts, {
      compose: async () => {
        calls += 1;
        return VALID;
      },
    });

    for (const params of [brief("   "), brief(undefined), {}, null]) {
      const result = await run(tool, params);
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("brief is required");
    }
    expect(calls).toBe(0);
    expect(artifacts.hudProgram).toBeUndefined();
  });

  it("declares exactly one tool with a plain JSON Schema and sequential execution", () => {
    const tool = createShowHudTool({}, { compose: async () => VALID });
    expect(tool.name).toBe("show_on_hud");
    expect(tool.executionMode).toBe("sequential");
    const params = tool.parameters as unknown as {
      type: string;
      properties: Record<string, { type: string }>;
      required: string[];
    };
    expect(params.type).toBe("object");
    expect(params.properties.brief?.type).toBe("string");
    expect(params.required).toEqual(["brief"]);
  });
});
