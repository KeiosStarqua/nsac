import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, useCopy } from "../../../shared/i18n";
import {
  ASTRONAUTS,
  astronautForKey,
  findAstronaut,
  moveSelection,
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

export function AstronautPicker({ open, roster, initialId, onSelect, onClose }: Props) {
  const copy = useCopy();
  const crew = roster && roster.length > 0 ? roster : ASTRONAUTS;
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

  const confirm = useCallback((id: string) => {
    if (id) onSelect(id);
  }, [onSelect]);

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
        setSelected(byDigit.id);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const next = moveSelection(crew, selected, event.key === "ArrowLeft" ? -1 : 1);
        if (next) {
          event.preventDefault();
          setSelected(next.id);
        }
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        const next = event.key === "Home" ? crew[0] : crew[crew.length - 1];
        if (next) {
          event.preventDefault();
          setSelected(next.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, crew, confirm, onClose]);

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
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`${styles.card} ${isSelected ? styles.cardSelected : styles.cardDim}`}
                onClick={() => setSelected(a.id)}
                onDoubleClick={() => confirm(a.id)}
                ref={(node) => {
                  if (node) cardRefs.current.set(a.id, node);
                  else cardRefs.current.delete(a.id);
                }}
              >
                <span className={styles.callsignRow}>
                  <span className={styles.callsign}>{a.callsign}</span>
                  <kbd className={styles.key} aria-hidden="true">{index + 1}</kbd>
                </span>
                <span className={styles.avatarRing}>
                  <span className={styles.initial}>{a.initial}</span>
                  {isSelected ? <span className={styles.check} aria-hidden="true">✓</span> : null}
                </span>
                <span className={styles.name}>{a.name}</span>
                <span className={styles.role}>{a.role}</span>
                <span className={styles.status}>{copy.astronaut.status}</span>
              </button>
            );
          })}
        </div>

        <button type="button" className={styles.confirm} onClick={() => confirm(chosen.id)}>
          {format(copy.astronaut.confirm, { name: chosen.name })}
        </button>
        <p className={styles.hint}>{copy.astronaut.hint}</p>
        <p className={styles.footer}>{copy.astronaut.footer}</p>
      </section>
    </div>
  );
}
