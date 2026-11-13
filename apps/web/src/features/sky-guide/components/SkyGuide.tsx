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
import { OpenRouterKeyDialog } from "./OpenRouterKeyDialog";
import { SkyAsk } from "./SkyAsk";
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
  /** Opens the dialog that asks for the OpenRouter key Sky needs to compose. Idempotent. */
  requestKey: () => void;
  /** Bumps every time a key is saved; stations compose again without the saved-panel cache. */
  keyVersion: number;
  /** Whether the Ask Sky panel (click-to-type instruction for the composer) is open. */
  askOpen: boolean;
  toggleAsk: () => void;
  closeAsk: () => void;
  /**
   * The latest instruction typed into the Ask Sky panel, with a sequence number so stations re-compose
   * on every submit. `null` until the first ask.
   */
  askRequest: { station: StationId; text: string; seq: number } | null;
  /** Sends a trimmed, capped instruction to the station Sky is sitting on right now. */
  submitAsk: (text: string) => void;
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
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyVersion, setKeyVersion] = useState(0);
  const [askOpen, setAskOpen] = useState(false);
  const [askRequest, setAskRequest] = useState<{ station: StationId; text: string; seq: number } | null>(null);
  const askSeq = useRef(0);
  const arrivedRef = useRef<StationId | null>(null);
  const requestKey = useCallback(() => setKeyDialogOpen(true), []);
  const toggleAsk = useCallback(() => setAskOpen((open) => !open), []);
  const closeAsk = useCallback(() => setAskOpen(false), []);
  const submitAsk = useCallback((text: string) => {
    // Capped and trimmed here as well as on the server (the server is the boundary that matters).
    const trimmed = text.trim().slice(0, 280);
    const station = arrivedRef.current;
    if (!trimmed || !station) return;
    askSeq.current += 1;
    setAskRequest({ station, text: trimmed, seq: askSeq.current });
    setAskOpen(false);
  }, []);

  const register = useCallback((id: StationId, element: HTMLElement | null) => {
    if (element) stations.current.set(id, element);
    else stations.current.delete(id);
  }, []);

  const onArrive = useCallback((id: StationId) => {
    arrivedRef.current = id;
    setArrivedAt(id);
    setVisited((previous) => (previous.has(id) ? previous : new Set(previous).add(id)));
  }, []);

  const onLeave = useCallback(() => {
    arrivedRef.current = null;
    setArrivedAt(null);
  }, []);
  const toggleTour = useCallback(() => setTouring((on) => !on), []);

  useGuidedTour(touring, stations, () => setTouring(false));

  const value = useMemo(
    () => ({ register, arrivedAt, visited, panels: panels.current, requestKey, keyVersion, askOpen, toggleAsk, closeAsk, askRequest, submitAsk }),
    [register, arrivedAt, visited, requestKey, keyVersion, askOpen, toggleAsk, closeAsk, askRequest, submitAsk],
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
      <SkyAsk />
      <OpenRouterKeyDialog
        open={keyDialogOpen}
        onOpenChange={setKeyDialogOpen}
        onSaved={() => {
          setKeyVersion((version) => version + 1);
          setKeyDialogOpen(false);
        }}
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
