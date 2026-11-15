import { useEffect, useState } from "react";
import { useCopy } from "~/shared/i18n";
import {
  getOpenCodeKeyInfoFn,
  saveOpenCodeKeyFn,
  clearOpenCodeKeyFn,
} from "../../api/opencode-key.functions";
import { useAdminGate } from "../admin-gate";
import {
  buttonClasses,
  dangerButtonClasses,
  ghostButtonClasses,
  inputClasses,
  muted,
} from "./classes";

type OpenCodeKeyInfo = { source: "env" | "file" | "none"; updatedAt: number | null };
type OpenCodeKeyState = { kind: "ok"; message: string } | { kind: "error"; message: string } | null;
const GO_KEY_REGEX = /^[!-~]{8,512}$/;

export function OpenCodeTab() {
  const copy = useCopy().admin;
  const { lock } = useAdminGate();

  // OpenCode Go key (agent). Write-only: the stored key is never rendered anywhere.
  const [goStatus, setGoStatus] = useState<OpenCodeKeyInfo | undefined>(undefined);
  const [goKey, setGoKey] = useState("");
  const [goBusy, setGoBusy] = useState(false);
  const [goClearBusy, setGoClearBusy] = useState(false);
  const [goConfirmClear, setGoConfirmClear] = useState(false);
  const [goState, setGoState] = useState<OpenCodeKeyState>(null);

  async function refreshGoStatus() {
    try {
      const r = await getOpenCodeKeyInfoFn();
      setGoStatus(r.status === "ok" ? { source: r.source, updatedAt: r.updatedAt } : { source: "none", updatedAt: null });
    } catch {
      setGoStatus({ source: "none", updatedAt: null });
    }
  }

  useEffect(() => {
    let cancelled = false;
    getOpenCodeKeyInfoFn()
      .then((r) => {
        if (!cancelled) {
          setGoStatus(r.status === "ok" ? { source: r.source, updatedAt: r.updatedAt } : { source: "none", updatedAt: null });
        }
      })
      .catch(() => {
        if (!cancelled) setGoStatus({ source: "none", updatedAt: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveGoKey() {
    const trimmed = goKey.trim();
    if (!GO_KEY_REGEX.test(trimmed) || goBusy) return;
    setGoBusy(true);
    setGoState(null);
    try {
      const r = await saveOpenCodeKeyFn({ data: { key: trimmed } });
      if (r.status === "ok") {
        setGoKey("");
        await refreshGoStatus();
        setGoState({ kind: "ok", message: copy.goKeySaved });
      } else if (r.status === "invalid_key") {
        setGoState({ kind: "error", message: copy.goKeyInvalidKey });
      } else if (r.status === "unauthorized") {
        lock();
      } else {
        setGoState({ kind: "error", message: copy.goKeySaveFailed });
      }
    } catch {
      setGoState({ kind: "error", message: copy.goKeySaveFailed });
    } finally {
      setGoBusy(false);
    }
  }

  async function clearGoKey() {
    if (goClearBusy) return;
    setGoClearBusy(true);
    setGoState(null);
    try {
      const r = await clearOpenCodeKeyFn();
      if (r.status === "ok") {
        await refreshGoStatus();
        setGoState({ kind: "ok", message: copy.goKeyClearDone });
      } else {
        lock();
      }
    } catch {
      setGoState({ kind: "error", message: copy.goKeyClearFailed });
    } finally {
      setGoClearBusy(false);
      setGoConfirmClear(false);
    }
  }

  return (
    <>
    <section
      aria-label={copy.goKeyTitle}
      className="rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`${muted} text-[12px] uppercase tracking-[1px]`}>
          {copy.goKeyTitle}
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-[1px] ${
            goStatus?.source && goStatus.source !== "none"
              ? "border-(--green) text-(--green)"
              : "border-(--border) text-(--muted)"
          }`}
        >
          {goStatus == null
            ? copy.checking
            : goStatus.source === "env"
              ? copy.goKeyConfiguredEnv
              : goStatus.source === "file"
                ? copy.goKeyConfiguredFile
                : copy.goKeyNotConfigured}
        </span>
      </div>
      {goStatus?.source === "env" && (
        <p className={`${muted} mt-2 text-[12px]`}>{copy.goKeyEnvHint}</p>
      )}
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void saveGoKey();
        }}
      >
        <label
          htmlFor="sky-opencode-key"
          className="mb-1.5 block text-[13px] text-(--muted)"
        >
          {copy.goKeyLabel}
        </label>
        <input
          id="sky-opencode-key"
          type="password"
          autoComplete="off"
          placeholder={goStatus?.source === "file" ? copy.goKeyPlaceholderStored : copy.goKeyPlaceholder}
          value={goKey}
          onChange={(e) => setGoKey(e.target.value)}
          className={inputClasses}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={goBusy || !GO_KEY_REGEX.test(goKey.trim())}
            className={buttonClasses}
          >
            {goBusy ? copy.goKeySaving : copy.goKeySave}
          </button>
          {goConfirmClear ? (
        <>
              <button
                type="button"
                onClick={clearGoKey}
                disabled={goClearBusy}
                className={dangerButtonClasses}
              >
                {goClearBusy ? copy.goKeyClearing : copy.goKeyClearConfirm}
              </button>
              <button
                type="button"
                onClick={() => setGoConfirmClear(false)}
                disabled={goClearBusy}
                className={ghostButtonClasses}
              >
                {copy.goKeyClearCancel}
              </button>
        </>
          ) : (
            <button
              type="button"
              onClick={() => setGoConfirmClear(true)}
              disabled={goClearBusy}
              className={dangerButtonClasses}
            >
              {copy.goKeyClear}
            </button>
          )}
          <div aria-live="polite" className="text-[13px]">
            {goState?.kind === "ok" && (
              <span className="text-(--green)">{goState.message}</span>
            )}
            {goState?.kind === "error" && (
              <span className="text-(--red)">{goState.message}</span>
            )}
          </div>
        </div>
      </form>
      <p className={`${muted} mt-2 text-[12px]`}>{copy.goKeyNote}</p>
    </section>
    </>
  );
}
