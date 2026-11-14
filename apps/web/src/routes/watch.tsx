import { createFileRoute } from "@tanstack/react-router";
import { SkyScreen } from "~/features/sky-hud";

// ssr: true — the shell (backdrop, watch HUD markup) is static and matches the client;
// mic, pager and claims mount client-side like `/`. No search params here on purpose:
// `?gen=` is the console's declarative-HUD flag and does not apply to the watch.
export const Route = createFileRoute("/watch")({
  ssr: true,
  component: WatchRoute,
});

function WatchRoute() {
  return <SkyScreen variant="watch" />;
}
