import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SkyScreen } from "~/features/sky-hud";
import { SkyScreenGen } from "~/features/hud-gen";

export const Route = createFileRoute("/")({
  // The homepage is the SKY HUD: the astronaut wellness interface pixel-matched to the reference
  // frame (see SKY_UI_COMPONENT_FUNCTIONAL_SPEC.md). Interactive canvas/voice experience; the page
  // still renders its essentials with the network unplugged. The former console lives at /console.
  //
  // `/` renders the declarative OpenUI HUD (`features/hud-gen`, preset-primary, agent-enhanced) by
  // default. `?gen=0` (persisted to localStorage `nsac.gen`) opts out to the staged HUD; `?gen=1`
  // (or no `gen` at all) selects the declarative one. Lenient: a bad value falls back and never throws.
  ssr: true,
  // The router's default search parser JSON-parses digit-like values, so `?gen=1` arrives as number 1
  // and a string enum always mismatches the canonical URL (SSR strips it with a 307). Keeping the
  // validated value numeric makes the round trip exact; anything else falls back without throwing.
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
  }),
  component: SkyScreenPage,
});

function SkyScreenPage() {
  // Read like `?bg=`: SSR renders the staged HUD, the client swaps in the declarative tree after
  // mount, persisting the choice to localStorage `nsac.gen` (no `gen` anywhere ⇒ declarative;
  // `?gen=0` opts out to staged, `?gen=1` opts in to declarative).
  const [gen, setGen] = useState(false);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("gen");
      const fromStorage = window.localStorage.getItem("nsac.gen");
      const chosen = fromUrl ?? fromStorage ?? "1";
      setGen(chosen !== "0");
      if (fromUrl !== null) window.localStorage.setItem("nsac.gen", fromUrl);
    } catch { /* ignore */ }
  }, []);
  return gen ? <SkyScreenGen /> : <SkyScreen variant="console" />;
}
