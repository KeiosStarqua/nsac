import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SkyHudMock } from "~/features/hud-mock";
import { SkyScreenGen } from "~/features/hud-gen";
import { useHudUi } from "~/features/hud-ui";

export const Route = createFileRoute("/")({
  // `/` is the console. Which variant it serves is an admin setting (`hud.ui`, edited on
  // `/admin/ui`):
  //   "mock" (default) → the "SKY · Astronaut Wellness" mock (`features/hud-mock`), a
  //                      three-column simulated dashboard around the unchanged voice orb.
  //   "gen"            → the declarative OpenUI tree (`features/hud-gen`) whose chat
  //                      `show_on_hud` path composes panels into the HUD.
  // One hidden per-load dev override remains and wins when present:
  //   `?arch=openui` → the gen tree, regardless of the admin setting.
  // There is no `?gen=0` (deleted); `?arch=openui` is the only switch. SSR always renders the
  // mock, so no hydration mismatch — the admin value and the override swap in after mount.
  ssr: true,
  validateSearch: z.object({
    arch: z.string().optional().catch(undefined),
  }),
  component: ConsoleRoute,
});

function ConsoleRoute() {
  const adminUi = useHudUi();
  const [openUi, setOpenUi] = useState(false);
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("arch") === "openui") setOpenUi(true);
    } catch {
      /* no URLSearchParams → keep the admin/default variant */
    }
  }, []);

  return openUi || adminUi === "gen" ? <SkyScreenGen /> : <SkyHudMock />;
}
