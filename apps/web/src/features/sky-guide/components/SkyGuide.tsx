import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { StationId } from "~/shared/sky";
import type { PanelOrigin } from "../model/panel";
import { SkyCompanion } from "./SkyCompanion";

export interface SettledPanel {
  readonly program: string;
  readonly origin: PanelOrigin;
}

interface SkyGuideValue {
  register: (id: StationId, element: HTMLElement | null) => void;
  /** The station Sky is perched on right now. */
  arrivedAt: StationId | null;
  /** Stations Sky has landed on at least once. Their panels stay open. */
  visited: ReadonlySet<StationId>;
  /** Accepted model panels by `station:locale`, so returning to a page does not ask the model again. */
  panels: Map<string, SettledPanel>;
}

const SkyGuideContext = createContext<SkyGuideValue | null>(null);

export function useSkyGuide(): SkyGuideValue {
  const value = useContext(SkyGuideContext);
  if (!value) throw new Error("useSkyGuide must be used inside <SkyGuideProvider>");
  return value;
}

/** How long Sky stays on each station during the guided tour before flying on. */
const TOUR_DWELL_MS = 7000;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Mounted once in the root layout. Hosts the flying Sky and the registry of stations on the page. */
export function SkyGuideProvider({ children }: { children: ReactNode }) {
  const stations = useRef(new Map<StationId, HTMLElement>());
  const panels = useRef(new Map<string, SettledPanel>());
  const [arrivedAt, setArrivedAt] = useState<StationId | null>(null);
  const [visited, setVisited] = useState<ReadonlySet<StationId>>(() => new Set());
  const [touring, setTouring] = useState(false);

  const register = useCallback((id: StationId, element: HTMLElement | null) => {
    if (element) stations.current.set(id, element);
    else stations.current.delete(id);
  }, []);

  const onArrive = useCallback((id: StationId) => {
    setArrivedAt(id);
    setVisited((previous) => (previous.has(id) ? previous : new Set(previous).add(id)));
  }, []);

  const onLeave = useCallback(() => setArrivedAt(null), []);
  const toggleTour = useCallback(() => setTouring((on) => !on), []);

  useGuidedTour(touring, stations, () => setTouring(false));

  const value = useMemo(
    () => ({ register, arrivedAt, visited, panels: panels.current }),
    [register, arrivedAt, visited],
  );

  return (
    <SkyGuideContext.Provider value={value}>
      {children}
      <SkyCompanion
        stations={stations}
        onArrive={onArrive}
        onLeave={onLeave}
        touring={touring}
        onToggleTour={toggleTour}
      />
    </SkyGuideContext.Provider>
  );
}

/**
 * The tour scrolls each station of the page into view in document order; Sky follows because it always
 * flies to the station in view. Any wheel, touch or key press outside the Sky button hands control back.
 */
function useGuidedTour(
  touring: boolean,
  stations: React.RefObject<Map<StationId, HTMLElement>>,
  stop: () => void,
) {
  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    if (!touring) return;
    const ordered = [...stations.current.values()].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const visitNext = () => {
      const element = ordered[index];
      if (!element) {
        stopRef.current();
        return;
      }
      index += 1;
      element.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      timer = setTimeout(visitNext, TOUR_DWELL_MS);
    };

    const interrupt = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-sky-button]")) return;
      stopRef.current();
    };

    visitNext();
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("keydown", interrupt);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("keydown", interrupt);
    };
  }, [touring, stations]);
}
