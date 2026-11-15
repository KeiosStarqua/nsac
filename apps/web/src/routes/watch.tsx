import { createFileRoute } from "@tanstack/react-router";
import { WatchScreen } from "~/features/sky-hud";

// ssr: true — the shell (backdrop, watch HUD markup) is static and matches the client;
// mic, pager and claims mount client-side like `/`. No search params here on purpose:
// the console's `?arch=openui` opt-back does not apply to the watch.
export const Route = createFileRoute("/watch")({
  ssr: true,
  component: WatchRoute,
});

function WatchRoute() {
  return <WatchScreen />;
}
