import "@tanstack/react-start/server-only";
import type { AgentProfile, AgentContext, AgentId } from "../agents/types";
import { getAgent } from "../agents/registry";
import { currentAgentCore } from "./agent-core.server";
import { sessionFactoryForCore } from "./agent-session.server";

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

/**
 * The one status mapping for a one-shot turn: create the session, race it against the profile's
 * wall-clock budget, dispose in every exit path. Both cores share this — only the factory differs —
 * so `missing_key` / `unavailable` / `timeout` mean exactly the same thing on either core.
 */
async function runSession(
  profile: AgentProfile,
  input: string,
  ctx: AgentContext,
  sessFactory: SessionFactory,
  opts: { signal?: AbortSignal },
): Promise<RunResult> {
  let session: { prompt: (text: string, opts: { onDelta?: (d: string) => void; signal?: AbortSignal }) => Promise<string>; dispose: () => void };
  try {
    session = await sessFactory(profile, ctx);
  } catch (e) {
    if ((e as { message?: string })?.message === "missing_key") return { status: "missing_key", text: "" };
    return { status: "unavailable", text: "" };
  }
  const ac = new AbortController();
  // `opts.signal` is the caller's own budget: a nested turn (e.g. `show_on_hud` delegating to
  // `sky-generative-ui`) must stop when the turn that asked for it is cancelled, instead of burning
  // tokens for up to its own timeout on a reply nobody will read.
  const onExternalAbort = () => ac.abort();
  if (opts.signal?.aborted) ac.abort();
  else opts.signal?.addEventListener("abort", onExternalAbort, { once: true });
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
  } finally {
    opts.signal?.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * One-shot agent run (`askSky`, HUD compose, generative-ui, medical officer). The core is resolved
 * from the backend setting (`agent.core`, default `pi`); a `setSessionFactory` injection from a test
 * short-circuits the core lookup entirely, exactly like before the dual-core change.
 */
export async function runAgent(
  profileId: AgentId,
  input: string,
  ctx: AgentContext = { request: input },
  opts: { signal?: AbortSignal } = {},
): Promise<RunResult> {
  const profile = getAgent(profileId);
  const merged: AgentContext = { ...ctx, request: ctx.request ?? input };
  const sessFactory = factory ?? ((await sessionFactoryForCore(await currentAgentCore())) as unknown as SessionFactory);
  return runSession(profile, input, merged, sessFactory, opts);
}
