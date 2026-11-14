import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "~/features/admin";

export const Route = createFileRoute("/admin")({
  // Hidden operator page: not linked from nav/HUD, robots noindex. `data-only` SSR: nothing to fetch
  // at load time (auth + catalog load client-side via server functions after mount), so a down
  // backend cannot break rendering.
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "Sky" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});
