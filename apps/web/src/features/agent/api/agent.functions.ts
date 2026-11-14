import { createServerFn } from "@tanstack/react-start";
import { listAgents } from "../agents/registry";
import { askSky } from "../runtime/orchestrator.server";

export const listAgentRoster = createServerFn({ method: "GET" }).handler(async () => {
  const { readOpenRouterKey } = await import("../runtime/pi.server");
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
  .validator((d: { request: string; surface: string }) => d)
  .handler(async ({ data }) => {
    const { runAgent } = await import("../runtime/run.server");
    const { validateProgram } = await import("../runtime/openui.server");
    const { getSurface } = await import("../agents/surfaces");
    const surface = getSurface(data.surface);
    const allowList = surface?.allowList ?? [];
    const res = await runAgent("sky-generative-ui", data.request, { request: data.request, surface: data.surface, allowList, maxChars: 4000 });
    if (res.status !== "ok") return { ok: false as const, status: res.status };
    const v = validateProgram(res.text, 4000, allowList);
    if (!v.ok) return { ok: false as const, reason: v.reason };
    return { ok: true as const, program: v.program };
  });

export const ask = createServerFn({ method: "POST" })
  .validator((d: { request: string; surface?: string }) => d)
  .handler(async ({ data }) => {
    return askSky(data.request, data.surface);
  });
