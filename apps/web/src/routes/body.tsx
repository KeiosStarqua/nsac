import { createFileRoute } from "@tanstack/react-router";
import { BodyMapPage } from "~/features/body-map";

export const Route = createFileRoute("/body")({
  ssr: true,
  component: BodyMapPage,
});
