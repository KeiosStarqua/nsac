import { createFileRoute } from "@tanstack/react-router";
import { SkyStation } from "~/features/sky-guide";
import { StoryReader, getStory } from "~/features/story";
import { getCopy, useCopy } from "~/shared/i18n";

export const Route = createFileRoute("/story")({
  // Full SSR: long-form reading content, the best case for server-rendered HTML.
  ssr: true,
  loader: () => getStory(),
  head: ({ match }) => {
    const copy = getCopy(match.context.locale);
    return {
      meta: [
        { title: copy.story.pageTitle },
        { name: "description", content: copy.story.pageDescription },
      ],
    };
  },
  errorComponent: StoryError,
  component: StoryPage,
});

function StoryPage() {
  return (
    <>
      <SkyStation id="story" placement="top" />
      <StoryReader story={Route.useLoaderData()} />
    </>
  );
}

function StoryError() {
  const copy = useCopy();
  return (
    <p role="alert" style={{ padding: "96px 24px", textAlign: "center" }}>
      {copy.story.unavailable}
    </p>
  );
}
