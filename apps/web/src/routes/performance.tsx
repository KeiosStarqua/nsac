import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_ASTRONAUT_ID } from "~/features/astronaut";
import { PerformancePage } from "~/features/performance";
import { getPerformance } from "~/features/performance/api/health.functions";

// ssr: true — the whole page is content: the 12 tiles, the deterministic insight and the fixture
// fallback all render on the server. The client only re-reads the stored astronaut id and, if it
// differs, asks the server function again.
export const Route = createFileRoute("/performance")({
  ssr: true,
  head: () => ({ meta: [{ title: "SKY / Human Performance" }] }),
  loader: async () => getPerformance({ data: { astronautId: DEFAULT_ASTRONAUT_ID } }),
  headers: () => ({ "cache-control": "no-store" }),
  component: PerformanceRoute,
});

function PerformanceRoute() {
  const initial = Route.useLoaderData();
  return <PerformancePage initial={initial} />;
}
