import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SkyHudMock } from "~/features/hud-mock";
import { SkyScreenGen } from "~/features/hud-gen";
import { SkyScreen } from "~/features/sky-hud";

export const Route = createFileRoute("/")({
  // `/` is the console: since 2026-11-15 the default is the "SKY · Astronaut Wellness" mock
  // (`features/hud-mock`) — a three-column simulated dashboard around the unchanged voice orb.
  // Two hidden opt-backs keep the earlier screens reachable without a link:
  //   `?gen=0`      → the staged SkyScreen (`features/sky-hud`, pixel-matched reference frame);
  //   `?arch=openui`→ the declarative OpenUI tree (`features/hud-gen`) whose chat `show_on_hud` path
  //                   still composes a panel into the HUD.
  // Any other value (or none) renders the mock. SSR always renders the mock, so no hydration
  // mismatch; the opt-backs swap in after mount, exactly as the previous `?gen=` switch did.
  ssr: true,
  // The router's default search parser JSON-parses digit-like values, so `?gen=0` arrives as number
  // 0 and a string enum always mismatches the canonical URL (SSR strips it with a 307). Keeping the
  // validated `gen` numeric makes the round trip exact; anything else falls back without throwing.
  validateSearch: z.object({
    gen: z
      .preprocess((value) => {
        if (value == null) return undefined;
        if (typeof value === "number") return value;
        const n = Number(value);
        return Number.isFinite(n) ? n : value;
      }, z.union([z.literal(0), z.literal(1)]))
      .optional()
      .catch(undefined),
    arch: z.string().optional().catch(undefined),
  }),
  component: SkyScreenPage,
});

type ConsoleView = "mock" | "staged" | "openui";

function SkyScreenPage() {
  const [view, setView] = useState<ConsoleView>("mock");
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("arch") === "openui") {
        setView("openui");
        return;
      }
      setView(params.get("gen") === "0" ? "staged" : "mock");
    } catch {
      /* no URLSearchParams → keep the default mock */
    }
  }, []);

  if (view === "staged") return <SkyScreen variant="console" />;
  if (view === "openui") return <SkyScreenGen />;
  return <SkyHudMock />;
}
