import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  // /admin deep-links to the default tab; back/forward and reloads work.
  beforeLoad: () => {
    throw redirect({ to: "/admin/models" });
  },
});
