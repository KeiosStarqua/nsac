import { createFileRoute } from "@tanstack/react-router";
import { SkyScreenGen } from "~/features/hud-gen";

// `/` is Hub Gen (the declarative OpenUI tree in `features/hud-gen`); no console switch remains.
export const Route = createFileRoute("/")({
  ssr: true,
  component: ConsoleRoute,
});

function ConsoleRoute() {
  return <SkyScreenGen />;
}
