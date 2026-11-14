import "@tanstack/react-start/server-only";
import type { AgentProfile } from "../agents/types";
import { getAgent } from "../agents/registry";

export type RunStatus = "ok" | "missing_key" | "unavailable" | "timeout";
export type RunResult = { status: RunStatus; text: string };

export type SessionFactory = (profile: AgentProfile) => Promise<{ prompt: (text: string, opts: { onDelta?: (d: string) => void; signal?: AbortSignal }) => Promise<string>; dispose: () => void }>;

let factory: SessionFactory | null = null;
export function setSessionFactory(f: SessionFactory | null) {
  factory = f;
}

export async function runAgent(profileId: string, input: string, ctx: any = {}): Promise<RunResult> {
  const profile = getAgent(profileId as any);
  const sessFactory = factory ?? (await import("./pi.server")).createSession;
  let session: any;
  try {
    session = await sessFactory(profile);
  } catch (e: any) {
    if (e?.message === "missing_key") return { status: "missing_key", text: "" };
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
  } catch (e: any) {
    clearTimeout(timer);
    session.dispose();
    if (e?.message === "timeout" || ac.signal.aborted) return { status: "timeout", text: "" };
    return { status: "unavailable", text: "" };
  }
}