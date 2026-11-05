import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { askShipAgent } from "~/server/agent.server";
import { scenarioInputSchema } from "~/shared/scenario/search";

const bodySchema = z.object({
  question: z.string().trim().min(1).max(300),
  scenario: scenarioInputSchema,
});

/**
 * Streams OpenUI Lang as plain text. Headers say where it came from so the UI can be honest about it:
 *   x-agent-source: ollama | built-in
 *   x-agent-reason: set when the built-in briefing replaced the model
 */
export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
        }
        const { question, scenario } = parsed.data;

        const result = await askShipAgent(question, {
          seed: scenario.seed,
          day: scenario.day,
          interventions: scenario.iv,
        });

        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const chunk of result.stream) controller.enqueue(encoder.encode(chunk));
            } catch (error) {
              console.error("[api/agent] stream failed", error);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            "x-agent-source": result.source,
            "x-agent-reason": encodeURIComponent(result.reason ?? ""),
          },
        });
      },
    },
  },
});
