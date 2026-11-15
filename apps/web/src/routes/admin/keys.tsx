import { createFileRoute } from "@tanstack/react-router";
import { ApiKeysTab } from "~/features/admin";

// Hidden operator page (see ../admin): noindex + data-only SSR, same contract as the layout.
export const Route = createFileRoute("/admin/keys")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "Sky" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ApiKeysTab,
});
