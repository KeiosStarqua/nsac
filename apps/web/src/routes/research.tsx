import { createFileRoute } from "@tanstack/react-router";
import { ResearchPage } from "~/features/research";

// ssr: true — the whole page is the committed research-data.json bundle; there is no fetch, no
// server function and no client-only state, so everything renders on the server and the client
// only hydrates. Kept static on purpose: the deploy path never touches the `data/` submodule.
export const Route = createFileRoute("/research")({
  ssr: true,
  head: () => ({ meta: [{ title: "SKY / Research Evidence" }] }),
  component: ResearchPage,
});
