import { createFileRoute } from "@tanstack/react-router";
import { SkyStation } from "~/features/sky-guide";

export const Route = createFileRoute("/")({
  // The homepage is the agent's console: one image of Sky and an interface composed with OpenUI.
  // No marketing sections here; the product concept lives on /concept.
  ssr: true,
  component: Home,
});

function Home() {
  return <SkyStation id="welcome" placement="top" />;
}
