import { useEffect, useRef, useState } from "react";
import { useCopy } from "~/shared/i18n";
import type { StationId } from "~/shared/sky";
import {
  bezier,
  controlPoint,
  easeInOutCubic,
  flightDurationMs,
  idlePoint,
  perchFor,
  pickStation,
  type Point,
  type Viewport,
} from "../model/flight";
import styles from "./SkyCompanion.module.css";
import { useSkyGuide } from "./SkyGuide";

/**
 * Static artwork of Sky. Placeholder until the final angel image lands: replace the file, or point this at
 * the new one (for example `/sky/angel.png`, transparent background, square). See apps/web/AGENTS.md.
 */
export const SKY_IMAGE = "/sky/angel.svg";

/** A station must stay the best candidate this long before Sky leaves for it, so scrolling does not jitter. */
const SETTLE_MS = 220;

interface Flight {
  readonly from: Point;
  readonly started: number;
  readonly duration: number;
}

interface SkyCompanionProps {
  stations: React.RefObject<Map<StationId, HTMLElement>>;
  onArrive: (id: StationId) => void;
  onLeave: () => void;
  touring: boolean;
  onToggleTour: () => void;
}

/**
 * The flying Sky. One `requestAnimationFrame` loop moves it by writing `transform` directly, so the page
 * does not re-render per frame. React state only changes on arrival and departure.
 */
export function SkyCompanion({ stations, onArrive, onLeave, touring, onToggleTour }: SkyCompanionProps) {
  const copy = useCopy();
  const { askOpen, toggleAsk } = useSkyGuide();
  const button = useRef<HTMLButtonElement>(null);
  // Client only: the position depends on the viewport, which the server does not have.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const element = button.current;
    if (!mounted || !element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let position: Point | null = null;
    let flight: Flight | null = null;
    let committed: StationId | null | undefined;
    let candidate: StationId | null = null;
    let candidateSince = 0;
    let frame = 0;

    const viewport = (): Viewport => ({
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
    });

    const targetFor = (id: StationId | null | undefined, view: Viewport, size: number): Point => {
      const station = id ? stations.current.get(id) : undefined;
      return station ? perchFor(station.getBoundingClientRect(), view, size) : idlePoint(view, size);
    };

    const tick = (now: number) => {
      const view = viewport();
      const size = element.offsetWidth;
      const boxes = [...stations.current].map(([id, node]) => ({ id, box: node.getBoundingClientRect() }));

      const picked = pickStation(boxes, view);
      if (picked !== candidate) {
        candidate = picked;
        candidateSince = now;
      }

      if (candidate !== committed && now - candidateSince >= SETTLE_MS) {
        const from = position ?? targetFor(committed, view, size);
        committed = candidate;
        onLeave();
        const to = targetFor(committed, view, size);
        flight = { from, started: now, duration: reducedMotion.matches ? 0 : flightDurationMs(from, to) };
        element.dataset.facing = to.x < from.x ? "left" : "right";
      }

      // The target is read every frame, so Sky stays on its station while the page scrolls.
      const target = targetFor(committed, view, size);
      if (flight) {
        const t = flight.duration === 0 ? 1 : Math.min(1, (now - flight.started) / flight.duration);
        position = bezier(flight.from, controlPoint(flight.from, target), target, easeInOutCubic(t));
        if (t >= 1) {
          flight = null;
          if (committed) onArrive(committed);
        }
      } else {
        position = target;
      }

      element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
      element.dataset.flying = flight ? "true" : "false";
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mounted, stations, onArrive, onLeave]);

  if (!mounted) return null;

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.sky}
        data-sky-button=""
        data-flying="false"
        aria-expanded={askOpen}
        aria-controls="sky-ask-panel"
        aria-label={askOpen ? copy.sky.ask.closeLabel : copy.sky.ask.openLabel}
        title={askOpen ? copy.sky.ask.closeLabel : copy.sky.ask.openLabel}
        onClick={toggleAsk}
      >
        <span className={styles.figure}>
          <img src={SKY_IMAGE} alt="" draggable={false} />
        </span>
      </button>
      <button type="button" className={styles.tourButton} data-sky-button="" aria-pressed={touring} onClick={onToggleTour}>
        {touring ? copy.sky.stopTour : copy.sky.startTour}
      </button>
    </>
  );
}
