import { createFileRoute } from "@tanstack/react-router";
import { SpacecraftPage } from "~/features/spacecraft";

// ssr: true — the shell (backdrop layers, fallback) is static and matches the
// client; the WebGL scene itself only mounts client-side behind a lazy import.
export const Route = createFileRoute("/spacecraft")({
  ssr: true,
  component: SpacecraftPageRoute,
});

function SpacecraftPageRoute() {
  // No chrome: browser back/URL or Escape (handled in SpacecraftPage) leaves the page.
  return <SpacecraftPage />;
}
