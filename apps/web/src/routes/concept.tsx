import { createFileRoute } from "@tanstack/react-router";
import { CoreFeatures } from "~/features/core-features";
import { Earth } from "~/features/earth";
import { Hazards } from "~/features/hazards";
import { Hero } from "~/features/hero";
import { MissionData } from "~/features/mission-data";
import { Modules } from "~/features/modules";
import { Pipeline } from "~/features/pipeline";
import { DemoTeaser, getAlertSnapshot } from "~/features/readiness-demo";
import { SkyStation } from "~/features/sky-guide";
import { SourcesList } from "~/features/sources";
import { StoryTeaser } from "~/features/story-teaser";
import { Trust } from "~/features/trust";

export const Route = createFileRoute("/concept")({
  ssr: true,
  loader: () => ({
    snapshot: getAlertSnapshot().catch(() => null),
  }),
  component: Concept,
});

function Concept() {
  const { snapshot } = Route.useLoaderData();
  return (
    <>
      <Hero />
      <SkyStation id="welcome" />
      <CoreFeatures />
      <Hazards />
      <SkyStation id="hazards" />
      <MissionData />
      <SkyStation id="data" />
      <Pipeline />
      <SkyStation id="pipeline" />
      <DemoTeaser snapshot={snapshot} />
      <StoryTeaser />
      <Modules />
      <Trust />
      <Earth />
      <SourcesList />
    </>
  );
}
