import { useEffect, useState } from "react";
import { useCopy } from "~/shared/i18n";
import {
  getElevenLabsStatusFn,
  setElevenLabsKeyFn,
  clearElevenLabsKeyFn,
} from "../../api/elevenlabs.functions";
import { useAdminGate } from "../admin-gate";
import {
  buttonClasses,
  dangerButtonClasses,
  ghostButtonClasses,
  inputClasses,
  muted,
} from "./classes";

type ElevenLabsStatus = { configured: boolean; updatedAt: number | null };
type ElevenLabsState = { kind: "ok"; message: string } | { kind: "error"; message: string } | null;

export function ElevenLabsTab() {
  const copy = useCopy().admin;
  const { lock } = useAdminGate();

  // ElevenLabs key (Sky TTS). Write-only: the stored key is never rendered anywhere.
  const [elevenStatus, setElevenStatus] = useState<ElevenLabsStatus | undefined>(undefined);
  const [elevenKey, setElevenKey] = useState("");
  const [elevenBusy, setElevenBusy] = useState(false);
  const [elevenClearBusy, setElevenClearBusy] = useState(false);
  const [elevenConfirmClear, setElevenConfirmClear] = useState(false);
  const [elevenState, setElevenState] = useState<ElevenLabsState>(null);

  useEffect(() => {
    let cancelled = false;
    getElevenLabsStatusFn()
      .then((r) => {
        if (!cancelled) setElevenStatus(r);
      })
      .catch(() => {
        if (!cancelled) setElevenStatus({ configured: false, updatedAt: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveElevenLabsKey() {
    const trimmed = elevenKey.trim();
    if (!trimmed || elevenBusy) return;
    setElevenBusy(true);
    setElevenState(null);
    try {
      const r = await setElevenLabsKeyFn({ data: { key: trimmed } });
      if (r.status === "ok") {
        setElevenKey("");
        setElevenStatus({ configured: true, updatedAt: r.updatedAt });
        setElevenState({ kind: "ok", message: copy.elevenlabsSaved });
      } else if (r.status === "invalid_key") {
        setElevenState({ kind: "error", message: copy.elevenlabsInvalidKey });
      } else if (r.status === "backend_error") {
        setElevenState({ kind: "error", message: copy.elevenlabsSaveFailed });
      } else {
        lock();
      }
    } catch {
      setElevenState({ kind: "error", message: copy.elevenlabsSaveFailed });
    } finally {
      setElevenBusy(false);
    }
  }

  async function clearElevenLabsKey() {
    if (elevenClearBusy) return;
    setElevenClearBusy(true);
    setElevenState(null);
    try {
      const r = await clearElevenLabsKeyFn();
      if (r.status === "ok") {
        setElevenStatus({ configured: false, updatedAt: null });
        setElevenState({ kind: "ok", message: copy.elevenlabsClearDone });
      } else if (r.status === "unauthorized") {
        lock();
      } else {
        setElevenState({ kind: "error", message: copy.elevenlabsClearFailed });
      }
    } catch {
      setElevenState({ kind: "error", message: copy.elevenlabsClearFailed });
    } finally {
      setElevenClearBusy(false);
      setElevenConfirmClear(false);
    }
  }

  return (
    <>
    <section
      aria-label={copy.elevenlabsTitle}
      className="rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`${muted} text-[12px] uppercase tracking-[1px]`}>
          {copy.elevenlabsTitle}
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-[1px] ${
            elevenStatus?.configured
              ? "border-(--green) text-(--green)"
              : "border-(--border) text-(--muted)"
          }`}
        >
          {elevenStatus?.configured ? copy.elevenlabsConfigured : copy.elevenlabsNotConfigured}
        </span>
      </div>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void saveElevenLabsKey();
        }}
      >
        <label
          htmlFor="sky-elevenlabs-key"
          className="mb-1.5 block text-[13px] text-(--muted)"
        >
          {copy.elevenlabsKeyLabel}
        </label>
        <input
          id="sky-elevenlabs-key"
          type="password"
          autoComplete="off"
          placeholder="sk_…"
          value={elevenKey}
          onChange={(e) => setElevenKey(e.target.value)}
          className={inputClasses}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={elevenBusy || elevenKey.trim().length === 0}
            className={buttonClasses}
          >
            {elevenBusy ? copy.elevenlabsSaving : copy.elevenlabsSave}
          </button>
          {elevenConfirmClear ? (
        <>
              <button
                type="button"
                onClick={clearElevenLabsKey}
                disabled={elevenClearBusy}
                className={dangerButtonClasses}
              >
                {elevenClearBusy ? copy.elevenlabsClearing : copy.elevenlabsClearConfirm}
              </button>
              <button
                type="button"
                onClick={() => setElevenConfirmClear(false)}
                disabled={elevenClearBusy}
                className={ghostButtonClasses}
              >
                {copy.elevenlabsClearCancel}
              </button>
        </>
          ) : (
            <button
              type="button"
              onClick={() => setElevenConfirmClear(true)}
              disabled={elevenClearBusy}
              className={dangerButtonClasses}
            >
              {copy.elevenlabsClear}
            </button>
          )}
          <div aria-live="polite" className="text-[13px]">
            {elevenState?.kind === "ok" && (
              <span className="text-(--green)">{elevenState.message}</span>
            )}
            {elevenState?.kind === "error" && (
              <span className="text-(--red)">{elevenState.message}</span>
            )}
          </div>
        </div>
      </form>
      <p className={`${muted} mt-2 text-[12px]`}>{copy.elevenlabsNote}</p>
    </section>
    </>
  );
}
