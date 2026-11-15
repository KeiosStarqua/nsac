import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SkyHudMock } from "~/features/hud-mock";
import { SkyScreenGen } from "~/features/hud-gen";

export const Route = createFileRoute("/")({
  // `/` is the console: since 2026-11-15 the default is the "SKY · Astronaut Wellness" mock
  // (`features/hud-mock`) — a three-column simulated dashboard around the unchanged voice orb.
  // One hidden opt-back keeps the earlier screen reachable without a link:
  //   `?arch=openui` → the declarative OpenUI tree (`features/hud-gen`) whose chat `show_on_hud`
  //                   path still composes a panel into the HUD.
  // Any other value (or none) renders the mock. SSR always renders the mock, so no hydration
  // mismatch; the opt-back swaps in after mount.
  ssr: true,
  validateSearch: z.object({
    arch: z.string().optional().catch(undefined),
  }),
  component: ConsoleRoute,
});

function ConsoleRoute() {
  const [view, setView] = useState<"mock" | "openui">("mock");
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("arch") === "openui") setView("openui");
    } catch {
      /* no URLSearchParams → keep the default mock */
    }
  }, []);

  return view === "openui" ? <SkyScreenGen /> : <SkyHudMock />;
}
