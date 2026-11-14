import { createFileRoute } from "@tanstack/react-router";
import { getSnapshot } from "~/features/health/api/health.functions";
import { HealthPage } from "~/features/health";

export const Route = createFileRoute("/health")({
  ssr: true,
  head: () => ({ meta: [{ title: "Health" }] }),
  loader: async () => getSnapshot(),
  headers: () => ({ "cache-control": "no-store" }),
  component: HealthRoute,
});

function HealthRoute() {
  const data = Route.useLoaderData();
  return <HealthPage initial={data} />;
}