import { createFileRoute } from "@tanstack/react-router";
import { DemoPlayer, DemoSearchSchema, getScenario, type Stage } from "~/features/readiness-demo";
import { SkyStation } from "~/features/sky-guide";
import { getCopy, useCopy } from "~/shared/i18n";
import { Section } from "~/shared/ui";

export const Route = createFileRoute("/demo")({
  // `data-only`: the loader runs on the server (the scenario comes from a server function), but the
  // component renders in the browser. The gauge animates and consumes a streamed server function, so
  // there is nothing useful to server-render, and the pending fallback below covers the first paint.
  ssr: "data-only",
  // Lenient: a bad `?stage=` is ignored (the page shows "alert") instead of an error page.
  validateSearch: DemoSearchSchema,
  loader: () => getScenario(),
  head: ({ match }) => {
    const copy = getCopy(match.context.locale);
    return { meta: [{ title: `${copy.demo.title} | Sky` }] };
  },
  pendingComponent: DemoPending,
  component: DemoPage,
});

function DemoPending() {
  const copy = useCopy();
  return (
    <Section id="demo" title={copy.demo.title} lead={copy.demo.lead}>
      <p aria-busy="true">…</p>
    </Section>
  );
}

function DemoPage() {
  const copy = useCopy();
  const scenario = Route.useLoaderData();
  const { stage = "alert" } = Route.useSearch();
  const navigate = Route.useNavigate();

  const onStageChange = (next: Stage) =>
    navigate({ search: (prev) => ({ ...prev, stage: next }), resetScroll: false });

  return (
    <Section id="demo" title={copy.demo.title} lead={copy.demo.lead}>
      <DemoPlayer scenario={scenario} stage={stage} onStageChange={onStageChange} />
      <SkyStation id="readiness" placement="inline" />
    </Section>
  );
}
