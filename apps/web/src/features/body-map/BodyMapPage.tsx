import { useNavigate } from "@tanstack/react-router";
import { BodyMapOverlay } from "./BodyMapOverlay";

export function BodyMapPage() {
  const navigate = useNavigate();
  return <BodyMapOverlay open onClose={() => navigate({ to: "/" })} />;
}