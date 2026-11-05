import type { ModuleId } from "@practice/sim";
import type { Frame, RosterEntry } from "~/shared/scenario/types";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

const MODULE_BOX: Record<ModuleId | "isolation", Box> = {
  habitat: { x: 20, y: 20, w: 300, h: 150, label: "Habitat" },
  lab: { x: 340, y: 20, w: 300, h: 150, label: "Lab" },
  galley: { x: 20, y: 190, w: 300, h: 150, label: "Galley" },
  gym: { x: 340, y: 190, w: 300, h: 150, label: "Gym" },
  isolation: { x: 660, y: 20, w: 80, h: 320, label: "Isolation" },
};

function slot(box: Box, index: number, vertical: boolean) {
  return vertical
    ? { x: box.x + box.w / 2, y: box.y + 70 + index * 80 }
    : { x: box.x + 55 + index * 80, y: box.y + 85 };
}

interface Props {
  roster: RosterEntry[];
  frame: Frame;
}

/**
 * Animated cabin. Crew dots glide between modules (CSS transition on transform);
 * sick crew pulse and shed small particles. Every motion is CSS, so scrubbing the day is instant.
 */
export function CabinMap({ roster, frame }: Props) {
  const counters: Record<string, number> = {};
  const placed = roster.map((person) => {
    const now = frame.crew.find((c) => c.id === person.id)!;
    const where = now.quarantined ? "isolation" : person.module;
    const index = (counters[where] = (counters[where] ?? -1) + 1);
    return { person, now, ...slot(MODULE_BOX[where], index, where === "isolation") };
  });

  return (
    <svg className="cabin" viewBox="0 0 760 360" role="img" aria-label="Map of the ship with crew positions">
      {Object.entries(MODULE_BOX).map(([id, b]) => (
        <g key={id}>
          <rect className={`cabin-room${id === "isolation" ? " isolation" : ""}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={14} />
          <text className="cabin-label" x={b.x + 14} y={b.y + 24}>
            {b.label}
          </text>
        </g>
      ))}

      {placed.map(({ person, now, x, y }) => (
        <g key={person.id} className="dot" style={{ transform: `translate(${x}px, ${y}px)` }}>
          {now.health === "infectious" && !now.quarantined
            ? [0, 1, 2, 3, 4].map((i) => (
                <circle
                  key={i}
                  className="spore"
                  r={3}
                  style={{
                    animationDelay: `${i * 0.45}s`,
                    ["--dx" as string]: `${Math.cos(i * 1.3) * 46}px`,
                    ["--dy" as string]: `${Math.sin(i * 1.3) * 34}px`,
                  }}
                />
              ))
            : null}
          {now.health === "infectious" ? (
            <circle className="pulse" r={20} style={{ opacity: 0.25 + now.severity * 0.6 }} />
          ) : null}
          <circle className={`body hl-body-${now.health}`} r={17} />
          <text className="initial" textAnchor="middle" dy="0.35em">
            {person.name[0]}
          </text>
          <text className="name" textAnchor="middle" y={34}>
            {person.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
