import { useEffect, useState } from "react";
import { format, useCopy } from "~/shared/i18n";
import {
  getHudBackgroundFn,
  setHudBackgroundFn,
  type HudBackground,
} from "~/features/hud-bg";
import { useAdminGate } from "../admin-gate";
import { buttonClasses, muted } from "./classes";

type ApplyState = { kind: "ok"; message: string } | { kind: "error"; message: string } | null;

const OPTIONS: ReadonlyArray<HudBackground> = ["particles", "galaxy"];

function stamp(ms: number): string {
  return `${new Date(ms).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

/**
 * `/admin/background` — the `/` backdrop picker.
 *
 * Two React Bits components only: Particles (default) and Galaxy. Admin always wins: the console
 * reads the backend setting after mount (`useHudBackground`) and the old `?bg=` / `nsac.bg`
 * mechanism is gone, so applying here changes what the next page load renders.
 */
export function BackgroundTab() {
  const copy = useCopy().admin;
  const { lock } = useAdminGate();

  const [current, setCurrent] = useState<HudBackground>("particles");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selection, setSelection] = useState<HudBackground>("particles");
  const [applying, setApplying] = useState(false);
  const [applyState, setApplyState] = useState<ApplyState>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    getHudBackgroundFn()
      .then((r) => {
        if (cancelled) return;
        if (r.status === "ok") {
          setCurrent(r.background);
          setSelection(r.background);
          setUpdatedAt(r.updatedAt);
        } else if (r.status === "unauthorized") {
          lock();
        } else {
          setLoadFailed(true);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadFailed(true);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lock]);

  async function apply() {
    if (applying || selection === current) return;
    setApplying(true);
    setApplyState(null);
    try {
      const r = await setHudBackgroundFn({ data: { background: selection } });
      if (r.status === "ok") {
        setCurrent(r.background);
        setSelection(r.background);
        setUpdatedAt(r.updatedAt);
        setApplyState({ kind: "ok", message: copy.backgroundSaved });
      } else if (r.status === "invalid_background") {
        setApplyState({ kind: "error", message: copy.backgroundInvalid });
      } else if (r.status === "backend_error") {
        setApplyState({ kind: "error", message: copy.backgroundSaveFailed });
      } else {
        lock();
      }
    } catch {
      setApplyState({ kind: "error", message: copy.backgroundSaveFailed });
    } finally {
      setApplying(false);
    }
  }

  const optionLabel = (id: HudBackground) => (id === "galaxy" ? copy.backgroundGalaxy : copy.backgroundParticles);
  const optionDesc = (id: HudBackground) =>
    id === "galaxy" ? copy.backgroundGalaxyDesc : copy.backgroundParticlesDesc;

  const statusLine = loadFailed
    ? copy.backgroundLoadFailed
    : updatedAt === null
      ? copy.backgroundNotConfigured
      : format(copy.backgroundUpdated, { time: stamp(updatedAt) });

  return (
    <section
      aria-label={copy.backgroundTitle}
      className="rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
    >
      <div className={`${muted} text-[12px] uppercase tracking-[1px]`}>{copy.backgroundTitle}</div>
      <p className={`${muted} mt-1 text-[12px]`}>{copy.backgroundDescription}</p>

      <div className="mt-3 text-[13px]">
        <span className={muted}>{copy.backgroundCurrent}: </span>
        <span className="font-semibold">{optionLabel(current)}</span>
        <span className={muted}> · {statusLine}</span>
      </div>

      <div role="radiogroup" aria-label={copy.backgroundTitle} className="mt-3 grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((id) => {
          const selected = selection === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setSelection(id);
                setApplyState(null);
              }}
              disabled={applying || !loaded}
              className={`cursor-pointer rounded-(--radius-sm)! border px-3.5 py-3 text-left text-[13px] disabled:opacity-60 ${
                selected ? "border-(--accent)" : "border-(--border) bg-transparent"
              }`}
            >
              <span className={`block font-semibold ${selected ? "text-(--accent)" : ""}`}>
                {optionLabel(id)}
              </span>
              <span className={`${muted} mt-0.5 block text-[12px]`}>{optionDesc(id)}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void apply()}
          disabled={applying || !loaded || selection === current}
          className={buttonClasses}
        >
          {applying ? copy.backgroundApplying : copy.backgroundApply}
        </button>
        <div aria-live="polite" className="text-[13px]">
          {applyState?.kind === "ok" && <span className="text-(--green)">{applyState.message}</span>}
          {applyState?.kind === "error" && <span className="text-(--red)">{applyState.message}</span>}
        </div>
      </div>

      <p className={`${muted} mt-2 text-[12px]`}>{copy.backgroundNote}</p>
    </section>
  );
}
