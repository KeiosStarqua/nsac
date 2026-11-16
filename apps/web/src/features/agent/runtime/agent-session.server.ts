import "@tanstack/react-start/server-only";
import type { AgentContext, AgentProfile } from "../agents/types";
import type { SessionFacade, TurnArtifacts } from "./pi.server";
import type { AgentCore } from "./agent-core.server";

/**
 * Core selection for a session — the one place that knows a SessionFacade can come from either
 * runtime (dual-core, HARNESSING §18).
 *
 * The two factories have the same signature: `(profile, ctx, overrides) → SessionFacade`. The pi
 * factory is imported from `pi.server.ts` (unchanged behaviour); the Mastra factory is imported
 * dynamically so `@mastra/core` + `@mastra/libsql` stay in a server chunk that only loads when the
 * admin has actually switched the core.
 */

export type CoreSessionOverrides = {
  sessionManager?: unknown;
  promptSuffix?: string;
  customTools?: unknown[];
  artifacts?: TurnArtifacts;
  /**
   * Mastra memory thread override. The pi core ignores it (its history lives in the
   * `sessionManager` file), the Mastra core uses it instead of the `astronaut:<id>` default — that is
   * how the HUD composer keeps its own thread (`hud:<id>`) apart from the chat thread.
   */
  threadId?: string;
};

export type CoreSessionFactory = (
  profile: AgentProfile,
  ctx?: AgentContext & Record<string, unknown>,
  overrides?: CoreSessionOverrides,
) => Promise<SessionFacade>;

export async function sessionFactoryForCore(core: AgentCore): Promise<CoreSessionFactory> {
  if (core === "mastra") {
    const mod = await import("../mastra/mastra-core.server");
    return mod.createMastraSession as unknown as CoreSessionFactory;
  }
  const mod = await import("./pi.server");
  return mod.createSession as unknown as CoreSessionFactory;
}
