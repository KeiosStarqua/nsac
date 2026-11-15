import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Mic, XCircle } from "lucide-react";
import { useCopy } from "~/shared/i18n";
import {
  getSpeechEngineStatusFn,
  probeSpeechEngineFn,
  createSpeechEngineFn,
  stopSpeechEngineFn,
  startSpeechEngineFn,
  deleteSpeechEngineFn,
} from "../api/speechEngine.functions";
import {
  connectionState,
  canCreateEngine,
  canDeleteEngine,
  showEnvShadowWarning,
  wsToggleAction,
  type SpeechEngineStatusData,
} from "../model/speechEngineView";
import { sectionCard, sectionHeader, sectionIcon, sectionTitle } from "./tabs/classes";

// The five /admin server functions return a discriminated AdminProxy<T>; "unauthorized" means the
// session cookie expired while the page was open, which bounces back to the unlock form.

type Busy = "probe" | "create" | "toggle" | "delete" | null;
type Feedback = { kind: "ok" | "error"; message: string } | null;

const mono = "font-(family-name:--mono)";
const muted = "text-(--muted)";
const buttonClasses =
  "cursor-pointer rounded-(--radius-sm)! border-none border-(--accent-ink) bg-(--accent) px-[18px] py-2 text-[14px]! font-semibold! text-(--accent-ink) disabled:opacity-60";
const ghostButtonClasses =
  "cursor-pointer rounded-(--radius-sm)! border border-(--border) bg-transparent px-[18px] py-2 text-[14px]! font-semibold! text-(--text) disabled:opacity-60";
const dangerButtonClasses =
  "cursor-pointer rounded-(--radius-sm)! border border-(--red) bg-transparent px-[18px] py-2 text-[14px]! font-semibold! text-(--red) disabled:opacity-60";
const sourceBadge =
  "rounded-(--radius-sm) border border-(--border) px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-(--muted)";

export function SpeechEnginePanel({ onSessionExpired }: { onSessionExpired?: () => void }) {
  const copy = useCopy().admin.speech;
  // undefined = loading, null = backend unreachable
  const [status, setStatus] = useState<SpeechEngineStatusData | null | undefined>(undefined);
  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [probeResult, setProbeResult] = useState<Feedback>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await getSpeechEngineStatusFn();
      if (r.status === "unauthorized") {
        onSessionExpired?.();
        return;
      }
      setStatus(r.status === "ok" ? r.data : null);
    } catch {
      setStatus(null);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const authed = useCallback(
    <T,>(r: { status: "ok"; data: T } | { status: "unauthorized" } | { status: "backend_error" }): T | null => {
      if (r.status === "unauthorized") {
        onSessionExpired?.();
        return null;
      }
      if (r.status === "backend_error") return null;
      return r.data;
    },
    [onSessionExpired],
  );

  async function runProbe() {
    if (busy) return;
    setBusy("probe");
    setProbeResult(null);
    try {
      const data = authed(await probeSpeechEngineFn());
      if (data === null) {
        setProbeResult({ kind: "error", message: copy.genericError });
        return;
      }
      setProbeResult(
        data.ok
          ? { kind: "ok", message: copy.probeOk }
          : { kind: "error", message: data.message ?? copy.probeFailed },
      );
    } catch {
      setProbeResult({ kind: "error", message: copy.genericError });
    } finally {
      setBusy(null);
    }
  }

  async function runCreate() {
    if (busy || !status || !canCreateEngine(status)) return;
    if (!window.confirm(copy.createConfirm)) return;
    setBusy("create");
    setFeedback(null);
    try {
      const data = authed(await createSpeechEngineFn({ data: {} }));
      if (data === null) {
        setFeedback({ kind: "error", message: copy.backendDown });
        return;
      }
      if (data.ok) {
        const shadowing = data.envShadowing ? ` ${copy.createEnvShadowNote}` : "";
        setFeedback({ kind: "ok", message: `${copy.createDone}${shadowing}` });
      } else {
        setFeedback({ kind: "error", message: data.message ?? data.error ?? copy.genericError });
      }
      await refresh();
    } catch {
      setFeedback({ kind: "error", message: copy.genericError });
    } finally {
      setBusy(null);
    }
  }

  async function runToggleWs() {
    if (busy || !status) return;
    setBusy("toggle");
    setFeedback(null);
    try {
      const fn = wsToggleAction(status) === "stop" ? stopSpeechEngineFn : startSpeechEngineFn;
      const data = authed(await fn());
      if (data === null) {
        setFeedback({ kind: "error", message: copy.backendDown });
        return;
      }
      setFeedback({ kind: "ok", message: copy.wsToggleDone });
      await refresh();
    } catch {
      setFeedback({ kind: "error", message: copy.genericError });
    } finally {
      setBusy(null);
    }
  }

  async function runDelete() {
    if (busy || !status || !canDeleteEngine(status)) return;
    const target = status.engineId ?? "";
    if (!window.confirm(copy.deleteConfirm.replace("{id}", target))) return;
    setBusy("delete");
    setFeedback(null);
    try {
      const data = authed(await deleteSpeechEngineFn({ data: {} }));
      if (data === null) {
        setFeedback({ kind: "error", message: copy.backendDown });
        return;
      }
      if (data.ok) {
        // The backend's note (env still set) is authoritative — show it verbatim.
        setFeedback({ kind: "ok", message: data.note ? `${copy.deleteDone} ${data.note}` : copy.deleteDone });
      } else {
        setFeedback({ kind: "error", message: data.message ?? data.error ?? copy.genericError });
      }
      await refresh();
    } catch {
      setFeedback({ kind: "error", message: copy.genericError });
    } finally {
      setBusy(null);
    }
  }

  const busyAny = busy !== null;

  return (
    <section aria-label={copy.title} className={sectionCard}>
      <div className={sectionHeader}>
        <h2 className={sectionTitle}>
          <Mic aria-hidden className={sectionIcon} strokeWidth={1.75} />
          {copy.title}
        </h2>
        {status && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] ${
              connectionState(status) === "connected"
                ? "border-(--green) text-(--green)"
                : "border-(--border) text-(--muted)"
            }`}
          >
            <span
              aria-hidden
              className={`inline-block size-2 rounded-full ${
                connectionState(status) === "connected" ? "animate-pulse bg-(--green)" : "bg-(--muted)"
              }`}
            />
            {connectionState(status) === "connected" ? copy.statusConnected : copy.statusNotConfigured}
          </span>
        )}
      </div>

      {status === undefined && <p className={`${muted} mt-3 text-[14px]`}>…</p>}

      {status === null && (
        <div className="mt-3">
          <p role="alert" className="text-[14px] text-(--yellow)">
            {copy.backendDown}
          </p>
          <button type="button" onClick={() => void refresh()} className={`${ghostButtonClasses} mt-3`}>
            {copy.retry}
          </button>
        </div>
      )}

      {status && (
        <>
          {/* Status rows */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={`${muted} text-[12px] uppercase tracking-[0.12em]`}>{copy.engineIdLabel}</span>
            {status.engineId ? (
              <>
                <code className={`${mono} break-all text-[14px]`}>{status.engineId}</code>
                {status.source && (
                  <span className={sourceBadge}>{status.source === "env" ? copy.sourceEnv : copy.sourceDb}</span>
                )}
              </>
            ) : (
              <span className={`${muted} text-[14px]`}>{copy.engineIdMissing}</span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] ${
                status.wsRunning ? "border-(--green) text-(--green)" : "border-(--border) text-(--muted)"
              }`}
            >
              {status.wsRunning ? copy.wsRunning : copy.wsStopped}
            </span>
            <span className={`${muted} text-[12px]`}>
              {copy.portLabel}: <span className={mono}>{status.port}</span>
            </span>
          </div>
          {status.lastError && (
            <p className="mt-1.5 text-[12px] text-(--red)">
              <span className={`${muted}`}>{copy.lastErrorLabel}:</span> {status.lastError}
            </p>
          )}
          {showEnvShadowWarning(status) && (
            <p role="status" className="mt-1.5 text-[12px] text-(--yellow)">
              {copy.envShadowWarning}
            </p>
          )}

          {/* Key row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-(--border) pt-2.5">
            <span className={`${muted} text-[12px] uppercase tracking-[0.12em]`}>{copy.apiKeyLabel}</span>
            {status.apiKeyConfigured ? (
              <span className="inline-flex items-center gap-1.5 text-[14px] text-(--green)">
                <CheckCircle2 aria-hidden className="size-4" /> {copy.apiKeyConfigured}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[14px] text-(--red)">
                <XCircle aria-hidden className="size-4" /> {copy.apiKeyMissing}
              </span>
            )}
          </div>
          <p className={`${muted} mt-1 text-[12px]`}>{copy.apiKeyHint}</p>

          {/* Actions */}
          <div className="mt-3 border-t border-(--border) pt-3">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void runProbe()} disabled={busyAny} className={ghostButtonClasses}>
                {busy === "probe" ? copy.probing : copy.probe}
              </button>
              {probeResult && (
                <div aria-live="polite" className="text-[14px]">
                  {probeResult.kind === "ok" ? (
                    <span className="inline-flex items-center gap-1.5 text-(--green)">
                      <CheckCircle2 aria-hidden className="size-4" /> {probeResult.message}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-(--red)">
                      <XCircle aria-hidden className="size-4" /> {probeResult.message}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3">
              <span title={canCreateEngine(status) ? undefined : copy.createDisabledNoKey} className="inline-block">
                <button
                  type="button"
                  onClick={() => void runCreate()}
                  disabled={busyAny || !canCreateEngine(status)}
                  className={buttonClasses}
                >
                  {busy === "create" ? copy.creating : copy.create}
                </button>
              </span>
              <p className={`${mono} mt-1.5 text-[12px] ${muted}`}>{copy.createSubline}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void runToggleWs()} disabled={busyAny} className={ghostButtonClasses}>
                {busy === "toggle"
                  ? copy.wsWorking
                  : wsToggleAction(status) === "stop"
                    ? copy.wsToggleStop
                    : copy.wsToggleStart}
              </button>
              <button
                type="button"
                onClick={() => void runDelete()}
                disabled={busyAny || !canDeleteEngine(status)}
                className={dangerButtonClasses}
              >
                {busy === "delete" ? copy.deleting : copy.delete}
              </button>
            </div>

            <div aria-live="polite" className="mt-2 text-[14px]">
              {feedback?.kind === "ok" && <span className="text-(--green)">{feedback.message}</span>}
              {feedback?.kind === "error" && <span className="text-(--red)">{feedback.message}</span>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
