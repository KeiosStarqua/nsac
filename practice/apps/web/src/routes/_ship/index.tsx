import { Await, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { OpenUiView } from "~/features/briefing";
import { CrewGrid } from "~/features/crew";
import { getBriefing, getTimeline } from "~/server/timeline.functions";

/**
 * Dashboard: ssr: true (default). Full document SSR.
 * The timeline is awaited, so the first HTML already has the crew and the numbers.
 * The briefing is NOT awaited: it streams in after the shell, behind a Suspense fallback.
 */
export const Route = createFileRoute("/_ship/")({
  ssr: true,
  loaderDeps: ({ search }) => ({ seed: search.seed, day: search.day, iv: search.iv }),
  loader: async ({ deps }) => {
    const timeline = await getTimeline({ data: { seed: deps.seed, iv: deps.iv, horizon: deps.day } });
    const briefing = getBriefing({ data: deps });
    return { timeline, briefing };
  },
  head: () => ({ meta: [{ title: "Dashboard · Ship Health" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { timeline, briefing } = Route.useLoaderData();
  const frame = timeline.frames[timeline.frames.length - 1]!;
  const s = frame.summary;

  return (
    <div className="stack">
      <section className="tiles">
        <Tile label="Healthy" value={s.susceptible} tone="ok" />
        <Tile label="Incubating" value={s.exposed} tone={s.exposed > 0 ? "watch" : "ok"} />
        <Tile label="Sick now" value={s.infectious} tone={s.infectious >= 3 ? "alert" : s.infectious > 0 ? "watch" : "ok"} />
        <Tile label="Recovered" value={s.recovered} tone="ok" />
      </section>

      <section>
        <h2 className="section-title">Crew</h2>
        <CrewGrid roster={timeline.roster} frame={frame} />
      </section>

      <section>
        <h2 className="section-title">Briefing</h2>
        <Suspense fallback={<div className="skeleton">Preparing today's briefing…</div>}>
          <Await promise={briefing}>{(b) => <OpenUiView program={b.text} />}</Await>
        </Suspense>
      </section>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: "ok" | "watch" | "alert" }) {
  return (
    <div className={`hl-tile hl-status-${tone}`}>
      <div className="hl-tile-label">{label}</div>
      <div className="hl-tile-value">{value}</div>
    </div>
  );
}
