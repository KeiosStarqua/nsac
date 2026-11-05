import { Link } from "@tanstack/react-router";
import { useScenario } from "~/features/scenario";
import type { Frame, RosterEntry } from "~/shared/scenario/types";

interface Props {
  roster: RosterEntry[];
  frame: Frame;
}

function CrewTile({ person, now }: { person: RosterEntry; now: Frame["crew"][number] }) {
  const { seed, day, iv } = useScenario();
  return (
    <Link
      to="/crew/$memberId"
      params={{ memberId: person.id }}
      search={{ seed, day, iv }}
      className={`hl-crew hl-health-${now.health} crew-link`}
    >
      <div className="hl-crew-name">{person.name}</div>
      <div className="hl-crew-role">{person.role}</div>
      <div className="hl-crew-state">
        {now.health}
        {now.quarantined ? " · isolated" : ""}
      </div>
      <div className="hl-meter" aria-label="severity">
        <div className="hl-meter-fill" style={{ width: `${Math.round(now.severity * 100)}%` }} />
      </div>
    </Link>
  );
}

export function CrewGrid({ roster, frame }: Props) {
  return (
    <div className="crew-grid">
      {roster.map((person) => {
        const now = frame.crew.find((c) => c.id === person.id);
        return now ? <CrewTile key={person.id} person={person} now={now} /> : null;
      })}
    </div>
  );
}
