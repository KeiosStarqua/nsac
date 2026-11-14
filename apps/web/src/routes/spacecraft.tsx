import { createFileRoute, Link } from "@tanstack/react-router";
import { SpacecraftPage } from "~/features/spacecraft";

export const Route = createFileRoute("/spacecraft")({
  ssr: true,
  component: SpacecraftPageRoute,
});

function SpacecraftPageRoute() {
  return (
    <>
      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 70 }}>
        <Link to="/">Back to HUD</Link>
      </div>
      <SpacecraftPage />
    </>
  );
}
