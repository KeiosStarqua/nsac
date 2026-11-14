import { createFileRoute, Link } from "@tanstack/react-router";
import { BodyMapPage } from "~/features/body-map";

export const Route = createFileRoute("/body")({
  ssr: true,
  component: BodyPage,
});

function BodyPage() {
  return (
    <>
      <div className="fixed top-[12px] left-[12px] z-[70]">
        <Link to="/">Back to HUD</Link>
      </div>
      <BodyMapPage />
    </>
  );
}
