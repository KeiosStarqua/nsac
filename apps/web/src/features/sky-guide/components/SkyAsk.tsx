import { useEffect, useId, useRef, useState } from "react";
import { useCopy } from "~/shared/i18n";
import styles from "./SkyAsk.module.css";
import { useSkyGuide } from "./SkyGuide";

/**
 * Sky comes on-screen to answer. Opened by clicking Sky: an inline instruction field that re-composes
 * the panel Sky is perched on with the viewer's text folded into the composer's prompt. No tools, no
 * actions — the same safety envelope as an unasked-for panel; the model output still passes review.
 */
export function SkyAsk() {
  const copy = useCopy();
  const { askOpen, closeAsk, submitAsk, arrivedAt } = useSkyGuide();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const hintId = useId();

  useEffect(() => {
    if (!askOpen) return;
    setValue("");
    const field = inputRef.current;
    if (field) field.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAsk();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [askOpen, closeAsk]);

  if (!askOpen) return null;

  return (
    <form
      id="sky-ask-panel"
      className={styles.panel}
      data-sky-button=""
      aria-label={copy.sky.ask.submitLabel}
      onSubmit={(event) => {
        event.preventDefault();
        const text = value.trim();
        if (!text) return;
        submitAsk(text);
        setValue("");
      }}
    >
      <label className={styles.label} htmlFor="sky-ask-field">
        <span className={styles.glyph} aria-hidden="true">
          ✦
        </span>
        <span className={styles.hint} id={hintId}>
          {arrivedAt ? (
            <>
              {copy.sky.ask.answering} <strong>{copy.sky.stations[arrivedAt].name}</strong>
            </>
          ) : (
            copy.sky.ask.placeholder
          )}
        </span>
      </label>
      <div className={styles.row}>
        <input
          ref={inputRef}
          id="sky-ask-field"
          className={styles.field}
          type="text"
          autoComplete="off"
          maxLength={280}
          placeholder={copy.sky.ask.placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby={hintId}
          aria-label={copy.sky.ask.submitLabel}
        />
        <button type="submit" className={styles.send} disabled={value.trim().length === 0}>
          {copy.sky.ask.submitLabel}
        </button>
      </div>
    </form>
  );
}
