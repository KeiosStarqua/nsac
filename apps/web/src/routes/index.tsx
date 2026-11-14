import { createFileRoute } from "@tanstack/react-router";
import { SkyScreen } from "~/features/sky-hud";

export const Route = createFileRoute("/")({
  // The homepage is the SKY HUD: the astronaut wellness interface pixel-matched to the reference
  // frame (see SKY_UI_COMPONENT_FUNCTIONAL_SPEC.md). Interactive canvas/voice experience; the page
  // still renders its essentials with the network unplugged. The former console lives at /console.
  ssr: true,
  component: SkyScreenPage,
});

function SkyScreenPage() {
  return <SkyScreen />;
}
