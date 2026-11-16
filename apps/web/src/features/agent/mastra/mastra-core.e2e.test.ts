import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMastraSession, setMastraAgentFactoryForTests } from "./mastra-core.server";
import { setMastraRootForTests, setObservabilityImportForTests } from "./mastra-observability.server";
import { resetAgentModelCacheForTests } from "../runtime/agent-model.server";
import { setSessionFactory } from "../runtime/run.server";
import { getAgent } from "../agents/registry";
import type { TurnArtifacts } from "../runtime/pi.server";

/**
 * End-to-end through the REAL Mastra runtime, against a local OpenAI-compatible endpoint.
 *
 * This is the test that proves the wiring the unit tests mock away: the model router accepts the
 * `{ id: "opencode-go/<model>", url, apiKey }` endpoint form, `modelSettings.maxOutputTokens`
 * reaches the wire as `max_tokens`, tool calls execute and come back as `tool-result` chunks,
 * LibSQL memory carries the thread across turns, and an abort ends the stream.
 *
 * No spend: the "provider" is a `node:http` server in this process. Keys are fake values.
 */

const VALID_PROGRAM = `root = Surface([footer])
footer = Footer()`;

type Recorded = { body: any };

function sse(delta: unknown, finish: string | null) {
  return `data: ${JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 1,
    model: "test-model",
    choices: [{ index: 0, delta, finish_reason: finish }],
  })}\n\n`;
}

function textSse(text: string): string {
  return sse({ role: "assistant", content: text }, null) + sse({}, "stop") + "data: [DONE]\n\n";
}

function toolCallSse(): string {
  return (
    sse(
      {
        role: "assistant",
        tool_calls: [
          {
            index: 0,
            id: "call_1",
            type: "function",
            function: { name: "show_on_hud", arguments: JSON.stringify({ brief: "show heart rate" }) },
          },
        ],
      },
      null,
    ) +
    sse({}, "tool_calls") +
    "data: [DONE]\n\n"
  );
}

describe("mastra core end-to-end (local OpenAI-compatible endpoint)", () => {
  let server: Server;
  let baseUrl: string;
  let dir: string;
  let recorded: Recorded[] = [];
  let mode: "text" | "tool" | "hang" = "text";

  const prev = {
    go: process.env.SKY_OPENCODE_API_KEY,
    goBase: process.env.SKY_OPENCODE_BASE_URL,
    provider: process.env.SKY_AGENT_PROVIDER,
    backend: process.env.BACKEND_URL,
    db: process.env.NSAC_SKY_MASTRA_DB,
    keyPath: process.env.NSAC_OPENCODE_KEY_PATH,
    lfPublic: process.env.LANGFUSE_PUBLIC_KEY,
    lfSecret: process.env.LANGFUSE_SECRET_KEY,
    lfBase: process.env.LANGFUSE_BASE_URL,
  };

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      // The model router may probe the endpoint (e.g. a models list); only chat steps are counted.
      if (!url.pathname.endsWith("/chat/completions")) {
        if (url.pathname.endsWith("/models")) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ object: "list", data: [{ id: "deepseek-v4.1-flash", object: "model" }] }));
          return;
        }
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        let body: any = null;
        try {
          body = JSON.parse(raw);
        } catch {
          body = null;
        }
        recorded.push({ body });
        res.writeHead(200, { "content-type": "text/event-stream" });
        if (mode === "hang") {
          // Open the stream, send one delta, then never finish: only an abort can end it.
          res.write(sse({ role: "assistant", content: "partial" }, null));
          return;
        }
        const roles: string[] = Array.isArray(body?.messages) ? body.messages.map((m: any) => m.role) : [];
        if (mode === "tool" && !roles.includes("tool")) {
          res.end(toolCallSse());
          return;
        }
        res.end(textSse(roles.includes("tool") ? "The display is updated." : "I am right here with you."));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    baseUrl = `http://127.0.0.1:${port}/v1`;
  });

  afterAll(() => {
    server?.close();
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nsac-mastra-e2e-"));
    recorded = [];
    mode = "text";
    process.env.SKY_OPENCODE_API_KEY = "test-go-key";
    process.env.SKY_OPENCODE_BASE_URL = baseUrl;
    process.env.SKY_AGENT_PROVIDER = "opencode-go";
    process.env.BACKEND_URL = "http://127.0.0.1:1";
    process.env.NSAC_SKY_MASTRA_DB = join(dir, "sky-mastra.db");
    process.env.NSAC_OPENCODE_KEY_PATH = join(dir, "no-such-key.json");
    resetAgentModelCacheForTests();
    // show_on_hud delegates to sky-generative-ui; that one-shot is stubbed to a valid program.
    setSessionFactory((async () => ({
      prompt: async () => VALID_PROGRAM,
      dispose: () => {},
    })) as any);
  });

  afterEach(() => {
    setSessionFactory(null);
    setMastraAgentFactoryForTests(null);
    setObservabilityImportForTests(null);
    setMastraRootForTests(undefined);
    resetAgentModelCacheForTests();
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore("SKY_OPENCODE_API_KEY", prev.go);
    restore("SKY_OPENCODE_BASE_URL", prev.goBase);
    restore("SKY_AGENT_PROVIDER", prev.provider);
    restore("BACKEND_URL", prev.backend);
    restore("NSAC_SKY_MASTRA_DB", prev.db);
    restore("NSAC_OPENCODE_KEY_PATH", prev.keyPath);
    restore("LANGFUSE_PUBLIC_KEY", prev.lfPublic);
    restore("LANGFUSE_SECRET_KEY", prev.lfSecret);
    restore("LANGFUSE_BASE_URL", prev.lfBase);
    rmSync(dir, { recursive: true, force: true });
  });

  const chatCtx = {
    request: "",
    astronaut: { name: "Ayla Reyes", role: "Commander", callsign: "AR" },
    astronautId: "ayla-reyes",
  };

  it("streams a plain reply through the real model router", { timeout: 30000 }, async () => {
    const session = await createMastraSession(getAgent("sky-chat"), chatCtx, { artifacts: {} });
    const deltas: string[] = [];
    const reply = await session.prompt("How am I doing?", { onDelta: (d) => deltas.push(d) });
    session.dispose();

    expect(reply).toBe("I am right here with you.");
    expect(deltas.join("")).toBe(reply);
    // One request, and the wire really carried the pinned max token budget + our model id.
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.body?.model).toBe("deepseek-v4.1-flash");
    expect(recorded[0]?.body?.max_tokens).toBe(2048);
  });

  it("executes show_on_hud, writes the reviewed program, and reports the tool outcome", { timeout: 30000 }, async () => {
    mode = "tool";
    const artifacts: TurnArtifacts = {};
    const session = await createMastraSession(getAgent("sky-chat"), chatCtx, { artifacts });
    const reply = await session.prompt("please show my heart rate", {});
    session.dispose();

    expect(reply).toBe("The display is updated.");
    expect(artifacts.hudProgram).toBe(VALID_PROGRAM);
    expect(artifacts.chatDock).toBe("right");
    expect(artifacts.tools).toEqual([{ name: "show_on_hud", ok: true }]);
    // Two model steps: the tool call, then the answer after the tool result.
    expect(recorded.length).toBe(2);
    expect(recorded[1]?.body?.messages.map((m: any) => m.role)).toContain("tool");
  });

  it("keeps the astronaut thread in LibSQL across turns", { timeout: 30000 }, async () => {
    const session = await createMastraSession(getAgent("sky-chat"), chatCtx, { artifacts: {} });
    await session.prompt("Remember: my dose is five.", {});
    recorded = [];
    await session.prompt("What did I just say?", {});
    session.dispose();

    const roles = recorded[0]?.body?.messages.map((m: any) => m.role) ?? [];
    expect(roles[0]).toBe("system");
    // History from the first turn is replayed into the second request by memory.
    expect(roles).toContain("assistant");
    expect(JSON.stringify(recorded[0]?.body?.messages)).toContain("my dose is five");
  });

  it("ships the working profile and its update tool on the chat request", { timeout: 30000 }, async () => {
    const session = await createMastraSession(getAgent("sky-chat"), chatCtx, { artifacts: {} });
    await session.prompt("How am I doing?", {});
    session.dispose();

    const body = recorded[0]?.body;
    const toolNames = (Array.isArray(body?.tools) ? body.tools : []).map((t: any) => t?.function?.name);
    expect(toolNames).toContain("show_on_hud");
    // Working memory is tool-call managed: the real runtime registers its update tool.
    expect(toolNames).toContain("updateWorkingMemory");

    const system = (body?.messages ?? []).find((m: any) => m.role === "system");
    const systemText = typeof system?.content === "string" ? system.content : JSON.stringify(system?.content ?? "");
    // The Markdown profile is in the system message, and the discipline block is in the prompt.
    expect(systemText).toContain("# Working profile");
    expect(systemText).toContain("never authorization to act");
  });

  it("separates threads per astronaut id", { timeout: 30000 }, async () => {    const a = await createMastraSession(getAgent("sky-chat"), chatCtx, { artifacts: {} });
    await a.prompt("Remember: my dose is five.", {});
    a.dispose();

    recorded = [];
    const b = await createMastraSession(
      getAgent("sky-chat"),
      { request: "", astronaut: { name: "Dae-Jung Park", role: "Pilot", callsign: "DP" }, astronautId: "dae-jung-park" },
      { artifacts: {} },
    );
    await b.prompt("What did I just say?", {});
    b.dispose();

    expect(JSON.stringify(recorded[0]?.body?.messages)).not.toContain("my dose is five");
  });

  it("an abort ends the stream and the prompt rejects", { timeout: 30000 }, async () => {
    mode = "hang";
    const session = await createMastraSession(getAgent("sky-chat"), chatCtx, { artifacts: {} });
    const ac = new AbortController();
    const pending = session.prompt("this one hangs", { signal: ac.signal });
    setTimeout(() => ac.abort(), 50);
    await expect(pending).rejects.toThrow("aborted");
    session.dispose();
  });

  it("exports real spans for a tool turn through the observability pipeline", { timeout: 30000 }, async () => {
    // Real `Observability` + the real Mastra root; only the Langfuse exporter is replaced by a
    // recorder, so nothing leaves the process (LANGFUSE_BASE_URL points at a dead local port and is
    // never contacted by the recorder). This is the proof the wiring produces spans at all — the
    // unit tests stop at `addAgent`.
    const { BaseExporter, Observability } = await import("@mastra/observability");
    const { TracingEventType } = await import("@mastra/core/observability");
    const spans: Array<{ type: string; name?: string }> = [];
    class RecordingExporter extends BaseExporter {
      name = "recording";
      async _exportTracingEvent(event: any) {
        if (event?.type !== TracingEventType.SPAN_ENDED) return;
        spans.push({ type: String(event.exportedSpan?.type), name: event.exportedSpan?.name });
      }
    }
    setObservabilityImportForTests(
      (async () => ({ Observability, LangfuseExporter: RecordingExporter })) as any,
    );
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";
    process.env.LANGFUSE_BASE_URL = "http://127.0.0.1:1";

    mode = "tool";
    const artifacts: TurnArtifacts = {};
    const session = await createMastraSession(getAgent("sky-chat"), chatCtx, { artifacts });
    const reply = await session.prompt("please show my heart rate", {});
    session.dispose();
    // Span export is dispatched asynchronously after the span ends.
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(reply).toBe("The display is updated.");
    const types = spans.map((span) => span.type);
    expect(types).toContain("agent_run");
    expect(types).toContain("model_generation");
    expect(types).toContain("tool_call");
  });
});
