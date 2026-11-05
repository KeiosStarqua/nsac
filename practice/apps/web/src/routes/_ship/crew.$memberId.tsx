import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useScenario } from "~/features/scenario";
import { getTimeline } from "~/server/timeline.functions";

function BackToDashboard({ children }: { children: string }) {
  const { seed, day, iv } = useScenario();
  return (
    <Link to="/" search={{ seed, day, iv }} className="back">
      {children}
    </Link>
  );
}

/** Param route: /crew/c5. Unknown ids become a proper 404 instead of an empty page. */
export const Route = createFileRoute("/_ship/crew/$memberId")({
  ssr: true,
  loaderDeps: ({ search }) => ({ seed: search.seed, day: search.day, iv: search.iv }),
  loader: async ({ params, deps }) => {
    const timeline = await getTimeline({ data: { seed: deps.seed, iv: deps.iv, horizon: deps.day } });
    const person = timeline.roster.find((r) => r.id === params.memberId);
    if (!person) throw notFound();
    return { timeline, person };
  },
  notFoundComponent: () => (
    <p className="page-note">
      No crew member with that id. <BackToDashboard>Back to the dashboard</BackToDashboard>
    </p>
  ),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.person.name ?? "Crew"} · Ship Health` }],
  }),
  component: CrewMember,
});

function CrewMember() {
  const { timeline, person } = Route.useLoaderData();
  const history = timeline.frames.map((f) => ({ day: f.day, me: f.crew.find((c) => c.id === person.id)! }));
  const now = history[history.length - 1]!.me;
  const events = timeline.events.filter((e) => e.memberIds.includes(person.id) && e.day <= timeline.frames.length - 1);

  return (
    <div className="stack">
      <div>
        <BackToDashboard>← Dashboard</BackToDashboard>
        <h2 className="section-title">
          {person.name} <small className="muted">{person.role} · {person.module}</small>
        </h2>
        <p className="muted">
          Today: <strong>{now.health}</strong>
          {now.quarantined ? " (in isolation)" : ""}
        </p>
      </div>

      <section>
        <h3 className="section-title">Health by day</h3>
        <div className="strip" role="img" aria-label="Health state for each day">
          {history.map(({ day, me }) => (
            <span
              key={day}
              className={`strip-cell hl-health-${me.health}`}
              title={`Day ${day}: ${me.health}`}
              style={{ opacity: me.health === "infectious" ? 0.45 + me.severity * 0.55 : 1 }}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="section-title">What happened</h3>
        {events.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="story">
            {events.map((e, i) => (
              <li key={i} className={`story-item sev-${e.severity}`}>
                <span className="story-day">Day {e.day}</span>
                <div>
                  <strong>{e.title}</strong>
                  <div className="muted">{e.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
