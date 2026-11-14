import { useNavigate } from "@tanstack/react-router";
import { BodyMapOverlay } from "./BodyMapOverlay";

/** `/body`: the fullscreen page variant — canvas, the "Body systems" rail, one attribution line. */
export function BodyMapPage() {
  const navigate = useNavigate();
  return <BodyMapOverlay open variant="page" onClose={() => navigate({ to: "/" })} />;
}
