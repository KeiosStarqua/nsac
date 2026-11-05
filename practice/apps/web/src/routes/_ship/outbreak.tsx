import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CabinMap, EpidemicCurve } from "~/features/outbreak";
import { useScenario } from "~/features/scenario";
import { getTimeline } from "~/server/timeline.functions";
import { HORIZON } from "~/shared/scenario/search";

/**
 * Animated story. ssr: 'data-only': the loader runs on the server and its data ships with the page,
 * but the component renders in the browser (it animates and runs a timer).
 * `day` is not a loader dependency, so playing or scrubbing never refetches: all 31 frames are already here.
 */
export const Route = createFileRoute("/_ship/outbreak")({
  ssr: "data-only",
  loaderDeps: ({ search }) => ({ seed: search.seed, iv: search.iv }),
  loader: ({ deps }) => getTimeline({ data: { seed: deps.seed, iv: deps.iv, horizon: HORIZON } }),
  pendingComponent: () => <div className="skeleton">Loading the ship…</div>,
  head: () => ({ meta: [{ title: "Outbreak story · Ship Health" }] }),
  component: OutbreakStory,
});

const PLAY_INTERVAL_MS = 1100;

function OutbreakStory() {
  const timeline = Route.useLoaderData();
  const { day, setDay } = useScenario();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (day >= HORIZON) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setDay(day + 1), PLAY_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [playing, day, setDay]);

  const frame = timeline.frames[Math.min(day, timeline.frames.length - 1)]!;
  const visible = timeline.events.filter((e) => e.day <= day);
  const latest = visible[visible.length - 1];
  const nameOf = (id: string) => timeline.roster.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="stack">
      <div className="story-controls">
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (day >= HORIZON) setDay(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? "Pause" : day >= HORIZON ? "Replay" : day === 0 ? "Play the story" : "Resume"}
        </button>
        <span className="muted">
          Day {day} · {frame.summary.infectious} sick · {frame.summary.exposed} incubating ·{" "}
          {frame.summary.recovered} recovered
        </span>
      </div>

      <div className="map-wrap">
        <CabinMap roster={timeline.roster} frame={frame} />
        <div className={`log sev-${latest?.severity ?? "info"}`} aria-live="polite" key={latest ? `${latest.day}-${latest.title}` : "empty"}>
          <small>Captain's log · day {latest?.day ?? 0}</small>
          <p>{latest ? latest.title : "All quiet on board. Everyone is healthy."}</p>
          {latest ? <p className="muted">{latest.detail}</p> : null}
        </div>
      </div>

      <section>
        <h3 className="section-title">Epidemic curve</h3>
        <EpidemicCurve frames={timeline.frames} day={day} total={timeline.roster.length} />
        <div className="legend">
          <span className="lg lg-exposed">Incubating</span>
          <span className="lg lg-infectious">Sick</span>
          <span className="lg lg-recovered">Recovered</span>
        </div>
      </section>

      <section>
        <h3 className="section-title">Story so far</h3>
        {visible.length === 0 ? (
          <p className="muted">Nothing has happened yet. Press play.</p>
        ) : (
          <ul className="story">
            {[...visible].reverse().map((e, i) => (
              <li key={`${e.day}-${i}`} className={`story-item sev-${e.severity}`}>
                <span className="story-day">Day {e.day}</span>
                <div>
                  <strong>{e.title}</strong>
                  <div className="muted">
                    {e.detail}
                    {e.memberIds.length > 0 ? ` (${e.memberIds.map(nameOf).join(", ")})` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
