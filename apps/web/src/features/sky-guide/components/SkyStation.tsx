import { Renderer } from "@openuidev/react-lang";
import { useCallback, useEffect, useReducer } from "react";
import { useCopy, useLocale } from "~/shared/i18n";
import { STATION_FACTS, type StationId } from "~/shared/sky";
import { streamStationPanel } from "../api/compose.functions";
import { PanelScopeProvider, parseSkyProgram, skyLibrary } from "../catalog/library";
import { initialPanel, panelReducer, visibleProgram, type PanelEvent, type PanelState } from "../model/panel";
import { extractProgram, reviewProgram } from "../model/program";
import { useSkyGuide } from "./SkyGuide";
import styles from "./SkyStation.module.css";

/**
 * A place on the page where Sky lands. Until Sky arrives it is a quiet line; on arrival it shows the
 * built-in OpenUI panel at once and asks the model to compose a better one.
 * `between` sits in the gap between two page sections, `inline` inside a section's content, `top` above a
 * page's own header. `headingLevel` tells the panel whether its title is the page title (`one`) or a
 * section title inside a page that already has one (`two`).
 */
export function SkyStation({
  id,
  placement = "between",
  headingLevel = "two",
  variant = "panel",
}: {
  id: StationId;
  placement?: "between" | "inline" | "top";
  headingLevel?: "one" | "two";
  /** `panel` is a card dropped into a page; `console` is the page itself. */
  variant?: "panel" | "console";
}) {
  const copy = useCopy();
  const locale = useLocale();
  const { register, arrivedAt, visited } = useSkyGuide();
  const ref = useCallback((element: HTMLDivElement | null) => register(id, element), [id, register]);

  return (
    <aside
      className={styles.station}
      data-placement={placement}
      data-variant={variant}
      aria-label={`Sky · ${copy.sky.stations[id].name}`}
    >
      <div ref={ref} className={styles.frame} data-arrived={arrivedAt === id}>
        {visited.has(id) ? (
          // Keyed by locale: a language switch starts a fresh panel in the new language.
          <StationPanel key={locale} id={id} headingLevel={headingLevel} />
        ) : (
          <p className={styles.waiting}>{copy.sky.waiting}</p>
        )}
      </div>
    </aside>
  );
}

function StationPanel({ id, headingLevel }: { id: StationId; headingLevel: "one" | "two" }) {
  const copy = useCopy();
  const locale = useLocale();
  const { panels, requestKey, keyVersion } = useSkyGuide();
  const preset = copy.sky.stations[id].preset;
  const [state, dispatch] = useReducer(
    (current: PanelState, event: PanelEvent) => panelReducer(current, event, preset),
    initialPanel,
  );

  useEffect(() => {
    const cacheKey = `${id}:${locale}`;
    const cached = panels.get(cacheKey);
    if (cached) {
      dispatch({ type: "restore", ...cached });
      return;
    }

    dispatch({ type: "arrive" });
    let cancelled = false;
    let draft = "";

    void (async () => {
      try {
        for await (const event of await streamStationPanel({ data: { station: id, locale } })) {
          if (cancelled) return;
          if (event.kind === "chunk") {
            draft += event.text;
            dispatch({ type: "chunk", text: event.text });
          } else if (event.kind === "end") {
            const program = extractProgram(draft);
            const review = reviewProgram(program, id, parseSkyProgram);
            if (!review.ok) console.info(`[sky] ${id}: model panel rejected`, review.reasons);
            dispatch({ type: "end", accepted: review.ok, program });
            panels.set(cacheKey, review.ok ? { program, origin: "model" } : { program: preset, origin: "rejected" });
            return;
          } else if (event.kind === "missing_key") {
            // Not cached: after a key is saved the panel composes again. The dialog asks for the key.
            dispatch({ type: "unavailable" });
            requestKey();
            return;
          } else {
            // Not cached: the model may be started later, and the next visit should try again.
            dispatch({ type: "unavailable" });
            return;
          }
        }
      } catch {
        if (!cancelled) dispatch({ type: "unavailable" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, locale, panels, preset, keyVersion, requestKey]);

  const draftProgram = state.kind === "composing" ? extractProgram(state.draft) : "";
  const program = visibleProgram(state, preset, draftProgram);
  const streaming = state.kind === "composing" && draftProgram.length > 0;
  const status = state.kind === "settled" ? copy.sky.origin[state.origin] : copy.sky.composing;

  return (
    <div className={styles.panel}>
      <PanelScopeProvider scope={{ facts: STATION_FACTS[id], headingLevel }}>
        <Renderer response={program} library={skyLibrary} isStreaming={streaming} />
      </PanelScopeProvider>
      <footer className={styles.meta}>
        <span aria-live="polite" data-state={state.kind}>
          {status}
        </span>
        {state.kind === "settled" && state.origin === "offline" ? (
          <button type="button" className={styles.fixKey} onClick={requestKey}>
            {copy.sky.keyDialog.fixKey}
          </button>
        ) : null}
        <span className={styles.disclaimer}>{copy.sky.disclaimer}</span>
      </footer>
    </div>
  );
}
