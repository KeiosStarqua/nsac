import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy deep link — the OpenCode key panel folded into "API Keys".
export const Route = createFileRoute("/admin/opencode")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/keys" });
  },
});
