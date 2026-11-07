import { createFileRoute } from "@tanstack/react-router";
import { Difference } from "~/features/difference";
import { Earth } from "~/features/earth";
import { Hero } from "~/features/hero";
import { Modules } from "~/features/modules";
import { Pipeline } from "~/features/pipeline";
import { DemoTeaser, getAlertSnapshot } from "~/features/readiness-demo";
import { SourcesList } from "~/features/sources";
import { StoryTeaser } from "~/features/story-teaser";
import { Trust } from "~/features/trust";

export const Route = createFileRoute("/")({
  // Full SSR: this is a content page. The HTML is complete before any JavaScript runs, which also
  // keeps it readable if the demo laptop's browser blocks scripts.
  ssr: true,
  loader: () => ({
    // Not awaited on purpose: the page shell is sent first and this resolves into the stream.
    // A failure becomes `null` so one slow or broken snapshot never takes the landing page down.
    snapshot: getAlertSnapshot().catch(() => null),
  }),
  component: Landing,
});

function Landing() {
  const { snapshot } = Route.useLoaderData();
  return (
    <>
      <Hero />
      <Difference />
      <Pipeline />
      <DemoTeaser snapshot={snapshot} />
      <StoryTeaser />
      <Modules />
      <Trust />
      <Earth />
      <SourcesList />
    </>
  );
}
