import { createFileRoute } from "@tanstack/react-router";
import { AgentConsole } from "~/features/agent";

/**
 * ssr: false. Nothing here is useful without the browser (it streams from /api/agent),
 * so skip the server render; the root shell and the layout still render on the server.
 */
export const Route = createFileRoute("/_ship/agent")({
  ssr: false,
  pendingComponent: () => <div className="skeleton">Opening the console…</div>,
  head: () => ({ meta: [{ title: "Ask the AI · Ship Health" }] }),
  component: AgentConsole,
});
