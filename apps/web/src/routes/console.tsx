import { createFileRoute } from "@tanstack/react-router";
import { SkyStation } from "~/features/sky-guide";

export const Route = createFileRoute("/console")({
  // The former homepage: Sky's console composed with OpenUI. Kept as a standalone route; `/` is the HUD.
  ssr: true,
  component: Console,
});

function Console() {
  return <SkyStation id="console" placement="top" headingLevel="one" variant="console" />;
}
