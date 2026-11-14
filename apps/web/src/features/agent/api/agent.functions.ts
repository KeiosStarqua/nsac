import { createServerFn } from "@tanstack/react-start";
import { listAgents } from "../agents/registry";
function readOpenRouterKey(): string | null {
  const raw = process.env.SKY_OPENROUTER_API_KEY;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return raw.trim();
}

export const listAgentRoster = createServerFn({ method: "GET" }).handler(async () => {
  const keyConfigured = readOpenRouterKey() !== null;
  return listAgents().map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    effectiveModel: process.env[a.modelEnv]?.trim() || a.defaultModel,
    keyConfigured,
  }));
});

export const composeSurface = createServerFn({ method: "POST" })
  .handler(async ({ data }: any) => {
    const { runAgent } = await import("../runtime/run.server");
    const { validateProgram } = await import("../runtime/openui.server");
    const res = await runAgent("sky-generative-ui", data.request, { surface: data.surface });
    if (res.status !== "ok") return { ok: false as const, status: res.status };
    const v = validateProgram(res.text, 4000, []);
    if (!v.ok) return { ok: false as const, reason: v.reason };
    return { ok: true as const, program: v.program };
  });