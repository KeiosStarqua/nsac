import "@tanstack/react-start/server-only";
import type { AgentProfile, AgentContext, AgentId } from "../agents/types";
import { getAgent } from "../agents/registry";

export type RunStatus = "ok" | "missing_key" | "unavailable" | "timeout";
export type RunResult =
  | { status: "ok"; text: string }
  | { status: "missing_key"; text: "" }
  | { status: "unavailable"; text: "" }
  | { status: "timeout"; text: "" };

export type SessionFactory = (
  profile: AgentProfile,
  ctx?: AgentContext,
) => Promise<{ prompt: (text: string, opts: { onDelta?: (d: string) => void; signal?: AbortSignal }) => Promise<string>; dispose: () => void }>;

let factory: SessionFactory | null = null;
export function setSessionFactory(f: SessionFactory | null) {
  factory = f;
}

export async function runAgent(profileId: AgentId, input: string, ctx: AgentContext = { request: input }): Promise<RunResult> {
  const profile = getAgent(profileId);
  const merged: AgentContext = { ...ctx, request: ctx.request ?? input };
  const sessFactory = factory ?? (await import("./pi.server")).createSession;
  let session: { prompt: (text: string, opts: { onDelta?: (d: string) => void; signal?: AbortSignal }) => Promise<string>; dispose: () => void };
  try {
    session = await sessFactory(profile, merged);
  } catch (e) {
    if ((e as { message?: string })?.message === "missing_key") return { status: "missing_key", text: "" };
    return { status: "unavailable", text: "" };
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), profile.timeoutMs);
  try {
    const text = await Promise.race([
      session.prompt(input, { signal: ac.signal }),
      new Promise<string>((_, reject) => ac.signal.addEventListener("abort", () => reject(new Error("timeout")))),
    ]);
    clearTimeout(timer);
    session.dispose();
    return { status: "ok", text };
  } catch (e) {
    clearTimeout(timer);
    session.dispose();
    if ((e as { message?: string })?.message === "timeout" || ac.signal.aborted) return { status: "timeout", text: "" };
    return { status: "unavailable", text: "" };
  }
}
