import "@tanstack/react-start/server-only";
import { routeRequest } from "../agents/orchestrator";
import { getAgent } from "../agents/registry";
import { runAgent } from "./run.server";
import { validateProgram } from "./openui.server";
import { getSurface } from "../agents/surfaces";

export type DispatchResult =
  | { status: "handled"; by: string; program: string }
  | { status: "rejected"; by: string; reason: string }
  | { status: "answered"; text: string }
  | { status: "missing_key" }
  | { status: "timeout" };

export async function askSky(request: string, surfaceId?: string): Promise<DispatchResult> {
  const specialistId = routeRequest(request);
  if (specialistId) {
    const profile = getAgent(specialistId);
    const surface = surfaceId ? getSurface(surfaceId) : null;
    const allowList = surface?.allowList ?? (profile.output.kind === "openui-program" ? profile.output.allowList : []);
    const maxChars = profile.output.kind === "openui-program" ? profile.output.maxChars : 4000;
    const res = await runAgent(specialistId, request, { request, surface: surfaceId, allowList, maxChars });
    if (res.status === "missing_key") return { status: "missing_key" };
    if (res.status === "timeout") return { status: "timeout" };
    if (res.status !== "ok") return { status: "rejected", by: specialistId, reason: res.status };
    const v = validateProgram(res.text, maxChars, allowList);
    if (!v.ok) return { status: "rejected", by: specialistId, reason: v.reason };
    return { status: "handled", by: specialistId, program: v.program };
  }
  const res = await runAgent("sky-orchestrator", request, { request });
  if (res.status === "missing_key") return { status: "missing_key" };
  if (res.status === "timeout") return { status: "timeout" };
  if (res.status !== "ok") return { status: "rejected", by: "sky-orchestrator", reason: res.status };
  return { status: "answered", text: res.text };
}
