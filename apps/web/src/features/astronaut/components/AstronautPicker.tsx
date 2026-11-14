import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, useCopy } from "../../../shared/i18n";
import {
  ASTRONAUTS,
  astronautForKey,
  findAstronaut,
  moveSelectionAvailable,
  type Astronaut,
} from "../model/astronauts";
import styles from "./AstronautPicker.module.css";

interface Props {
  /** Rendered by the parent only when the picker should be visible. */
  readonly open: boolean;
  /** Roster from the backend; the bundled fixture is used when absent or empty. */
  readonly roster?: readonly Astronaut[];
  /** Currently saved crew member, so reopening pre-selects it. */
  readonly initialId?: string | null;
  /** Crew ids held by *other* sessions. My own claim must be in `mineId`, not here. */
  readonly takenIds?: ReadonlySet<string>;
  /** Crew id this session currently holds; stays selectable even when `takenIds` is stale. */
  readonly mineId?: string | null;
  /** A claim request is in flight — every confirm/double-click is locked out. */
  readonly claiming?: boolean;
  /** Inline error under the rail (e.g. someone else just took the selected card). */
  readonly error?: string | null;
  readonly onSelect: (id: string) => void;
  /** Omitted on the first visit: there is no valid state to return to yet. */
  readonly onClose?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function AstronautPicker({ open, roster, initialId, takenIds, mineId, claiming = false, error, onSelect, onClose }: Props) {
  const copy = useCopy();
  const crew = roster && roster.length > 0 ? roster : ASTRONAUTS;
  const isTaken = useCallback(
    (id: string) => (takenIds?.has(id) ?? false) && id !== mineId,
    [takenIds, mineId],
  );
  const defaultId = useMemo(
    () => findAstronaut(initialId, crew)?.id ?? crew[0]?.id ?? "",
    [initialId, crew],
  );
  const [selected, setSelected] = useState<string>(defaultId);
  const panelRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());

  // Reset to the saved astronaut (or Ayla) each time the dialog opens.
  useEffect(() => {
    if (open) setSelected(defaultId);
  }, [open, defaultId]);

  // Keep the selection valid when the API roster replaces the fixture.
  useEffect(() => {
    if (!crew.some((a) => a.id === selected)) setSelected(defaultId);
  }, [crew, selected, defaultId]);

  // Move focus into the dialog and scroll the active card into view.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    panelRef.current?.focus();
    return () => {
      (returnFocusRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    cardRefs.current.get(selected)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [open, selected]);

  const taken = useMemo(() => {
    const s = new Set(takenIds ?? []);
    if (mineId) s.delete(mineId);
    return s;
  }, [takenIds, mineId]);
  // Confirm is only legal for an available selection with no claim in flight.
  const selectionTaken = isTaken(selected);
  const canConfirm = !claiming && !selectionTaken && selected.length > 0;

  const confirm = useCallback(
    (id: string) => {
      if (!id || claiming) return;
      if (isTaken(id)) return;
      onSelect(id);
    },
    [claiming, isTaken, onSelect],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      // Let the explicit close control handle its own activation.
      if ((event.target as HTMLElement | null)?.closest?.("[data-picker-close]")) return;

      if (event.key === "Enter") {
        event.preventDefault();
        confirm(selected);
        return;
      }
      if (event.key === "Escape" && onClose) {
        event.preventDefault();
        onClose();
        return;
      }

      const byDigit = astronautForKey(event.key, crew);
      if (byDigit) {
        event.preventDefault();
        if (!isTaken(byDigit.id)) setSelected(byDigit.id);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const next = moveSelectionAvailable(crew, taken, selected, event.key === "ArrowLeft" ? -1 : 1);
        if (next) {
          event.preventDefault();
          setSelected(next.id);
        }
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        const available = crew.filter((a) => !isTaken(a.id));
        const next = event.key === "Home" ? available[0] : available[available.length - 1];
        if (next) {
          event.preventDefault();
          setSelected(next.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, crew, taken, isTaken, confirm, onClose]);

  if (!open) return null;

  const chosen = findAstronaut(selected, crew) ?? crew[0];
  if (!chosen) return null;

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="astronaut-picker-title"
        aria-describedby="astronaut-picker-subtitle"
        tabIndex={-1}
        ref={panelRef}
      >
        {onClose ? (
          <button
            type="button"
            className={styles.close}
            aria-label={copy.astronaut.close}
            data-picker-close
            onClick={onClose}
          >
            ×
          </button>
        ) : null}

        <div className={styles.header}>
          <span className={styles.pill}>{copy.astronaut.eyebrow}</span>
          <h2 id="astronaut-picker-title" className={styles.title}>{copy.astronaut.title}</h2>
          <p id="astronaut-picker-subtitle" className={styles.subtitle}>{copy.astronaut.subtitle}</p>
        </div>

        <div className={styles.rail} role="radiogroup" aria-labelledby="astronaut-picker-title">
          {crew.map((a, index) => {
            const isSelected = selected === a.id;
            const cardTaken = isTaken(a.id);
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-disabled={cardTaken || undefined}
                disabled={cardTaken}
                className={`${styles.card} ${isSelected ? styles.cardSelected : styles.cardDim}${cardTaken ? ` ${styles.cardTaken}` : ""}`}
                onClick={() => { if (!cardTaken) setSelected(a.id); }}
                onDoubleClick={() => confirm(a.id)}
                ref={(node) => {
                  if (node) cardRefs.current.set(a.id, node);
                  else cardRefs.current.delete(a.id);
                }}
              >
                <span className={styles.callsignRow}>
                  <span className={styles.callsign}>{a.callsign}</span>
                  {cardTaken ? null : <kbd className={styles.key} aria-hidden="true">{index + 1}</kbd>}
                </span>
                <span className={styles.avatarRing}>
                  <span className={styles.initial}>{a.initial}</span>
                  {isSelected ? <span className={styles.check} aria-hidden="true">✓</span> : null}
                </span>
                <span className={styles.name}>{a.name}</span>
                <span className={styles.role}>{a.role}</span>
                {cardTaken ? (
                  <span className={styles.takenBadge}>{copy.astronaut.taken}</span>
                ) : (
                  <span className={styles.status}>{copy.astronaut.status}</span>
                )}
              </button>
            );
          })}
        </div>

        {error ? (
          <p className={styles.error} role="alert">{error}</p>
        ) : null}
        <button
          type="button"
          className={styles.confirm}
          disabled={!canConfirm}
          onClick={() => confirm(chosen.id)}
        >
          {claiming
            ? copy.astronaut.claiming
            : selectionTaken
              ? copy.astronaut.takenCta
              : format(copy.astronaut.confirm, { name: chosen.name })}
        </button>
        <p className={styles.hint}>{copy.astronaut.hint}</p>
        <p className={styles.footer}>{copy.astronaut.footer}</p>
      </section>
    </div>
  );
}
