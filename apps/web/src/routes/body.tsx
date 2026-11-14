import { createFileRoute, Link } from "@tanstack/react-router";
import { BodyMapPage } from "~/features/body-map";

export const Route = createFileRoute("/body")({
  ssr: true,
  component: BodyPage,
});

function BodyPage() {
  return (
    <>
      <div style={{ position: "fixed", top: 12, left: 12, zIndex: 70 }}>
        <Link to="/">Back to HUD</Link>
      </div>
      <BodyMapPage />
    </>
  );
}