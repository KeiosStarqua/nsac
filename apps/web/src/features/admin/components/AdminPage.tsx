import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useCopy } from "~/shared/i18n";
import {
  unlockAdminFn,
  isAdminFn,
  adminModelFn,
  setAgentModelFn,
} from "../api/admin.functions";
import type { CatalogModel } from "../runtime/openrouter.server";

type Phase = "checking" | "unconfigured" | "locked" | "admin";
type ApplyState = { kind: "ok" } | { kind: "error"; message: string } | null;

const page = "min-h-screen bg-(--bg) text-(--text) font-(family-name:--font)";
const panel = "mx-auto max-w-[1040px] px-5 pt-7 pb-12";
const mono = "font-(family-name:--mono)";
const muted = "text-(--muted)";
// `!` marks the few utilities that must win against globals.css, whose reset is unlayered and therefore
// outranks Tailwind's utility layer: `button { font: inherit }` (font-size/weight) and
// `:focus-visible { border-radius: 4px }` (radius on any focusable control).
const inputClasses =
  "w-full rounded-(--radius-sm)! border border-(--border) bg-(--surface) px-3 py-2.5 text-[14px] text-(--text)";
const buttonClasses =
  "cursor-pointer rounded-(--radius-sm)! border-none border-(--accent-ink) bg-(--accent) px-[18px] py-2.5 text-[14px]! font-semibold! text-(--accent-ink) disabled:opacity-60";

// Shared skeleton of a model row: the five columns, the 1px border and the 8px/10px padding. The
// colour, radius and cursor differ per usage (header vs row) and are appended at the call site so the
// two never disagree.
const rowGrid =
  "grid w-full grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.7fr)] items-baseline gap-2 border px-2.5 py-2 text-left";

function fmtPrice(p: string | null): string {
  if (p == null) return "—";
  const perMillion = Number(p) * 1e6;
  if (!Number.isFinite(perMillion)) return "—";
  if (perMillion === 0) return "$0/M";
  if (perMillion < 0.01) return "<$0.01/M";
  return `$${perMillion.toFixed(2)}/M`;
}
const fmtContext = (n: number | null) => (n == null ? "—" : n.toLocaleString());
const fmtCreated = (s: number | null) => (s == null ? "—" : new Date(s * 1000).toISOString().slice(0, 10));

export function AdminPage() {
  const copy = useCopy().admin;
  const [phase, setPhase] = useState<Phase>("checking");

  // Unlock form
  const [key, setKey] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Authenticated state
  const [effectiveModel, setEffectiveModel] = useState<string | null>(null);
  const [setting, setSetting] = useState<{ model: string | null; updatedAt: number | null } | null | undefined>(undefined);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [catalogOk, setCatalogOk] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyState, setApplyState] = useState<ApplyState>(null);

  useEffect(() => {
    let cancelled = false;
    isAdminFn()
      .then((r) => {
        if (cancelled) return;
        setPhase(!r.configured ? "unconfigured" : r.admin ? "admin" : "locked");
      })
      .catch(() => {
        if (!cancelled) setPhase("locked");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "admin") return;
    let cancelled = false;
    setLoadingModels(true);
    adminModelFn()
      .then((r) => {
        if (cancelled) return;
        if (r.status === "ok") {
          setEffectiveModel(r.effectiveModel);
          setSetting(r.setting);
          setModels(r.models);
          setCatalogOk(r.catalogOk);
          setSelectedId((prev) => prev ?? r.effectiveModel);
        } else {
          setPhase("locked");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setModels([]);
        setCatalogOk(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  }, [models, query]);

  async function submitUnlock(e: FormEvent) {
    e.preventDefault();
    if (unlockBusy || key.length === 0) return;
    setUnlockBusy(true);
    setUnlockError(null);
    try {
      const r = await unlockAdminFn({ data: { key } });
      if (r.status === "ok") {
        setKey("");
        setPhase("admin");
      } else if (r.status === "not_configured") {
        setPhase("unconfigured");
      } else {
        setUnlockError(copy.denied);
      }
    } catch {
      setUnlockError(copy.denied);
    } finally {
      setUnlockBusy(false);
    }
  }

  async function apply() {
    if (!selectedId || applying) return;
    setApplying(true);
    setApplyState(null);
    try {
      const r = await setAgentModelFn({ data: { model: selectedId } });
      if (r.status === "ok") {
        setEffectiveModel(r.model);
        setSetting({ model: r.model, updatedAt: r.updatedAt });
        setApplyState({ kind: "ok" });
      } else if (r.status === "invalid_model") {
        setApplyState({ kind: "error", message: copy.invalidModel });
      } else if (r.status === "catalog_unavailable") {
        setApplyState({ kind: "error", message: copy.catalogUnavailable });
      } else if (r.status === "backend_error") {
        setApplyState({ kind: "error", message: copy.backendError });
      } else {
        setApplyState({ kind: "error", message: copy.unauthorized });
        setPhase("locked");
      }
    } catch {
      setApplyState({ kind: "error", message: copy.applyFailed });
    } finally {
      setApplying(false);
    }
  }

  if (phase === "checking") {
    return (
      <main className={page}>
        <div className={panel}>
          <p className={muted}>{copy.checking}</p>
        </div>
      </main>
    );
  }

  if (phase === "unconfigured") {
    return (
      <main className={page}>
        <div className={panel}>
          <h1 className="text-[20px]">{copy.title}</h1>
          <p className={muted}>{copy.notConfigured}</p>
        </div>
      </main>
    );
  }

  if (phase === "locked") {
    return (
      <main className={page}>
        <div className="mx-auto max-w-[420px] px-5 pt-7 pb-12">
          <h1 className="mb-4! text-[20px]">{copy.unlockTitle}</h1>
          <form onSubmit={submitUnlock}>
            <label
              htmlFor="sky-admin-key"
              className="mb-1.5 block text-[13px] text-(--muted)"
            >
              {copy.keyLabel}
            </label>
            <input
              id="sky-admin-key"
              type="password"
              autoComplete="off"
              autoFocus
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className={inputClasses}
            />
            {unlockError && (
              <p role="alert" className="mt-2.5! text-[13px] text-(--red)">
                {unlockError}
              </p>
            )}
            <button
              type="submit"
              disabled={unlockBusy || key.length === 0}
              className={`${buttonClasses} mt-3.5`}
            >
              {unlockBusy ? copy.unlocking : copy.unlock}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className={page}>
      <div className={panel}>
        <h1 className="mb-3! text-[20px]">{copy.title}</h1>

        <section
          aria-label={copy.currentEffective}
          className="mb-4 rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
        >
          <div className={`${muted} text-[12px] uppercase tracking-[1px]`}>
            {copy.currentEffective}
          </div>
          <div className={`${mono} mt-1 text-[16px] break-all`}>
            {effectiveModel ?? "…"}
          </div>
          <div className={`${muted} mt-1.5 text-[12px]`}>
            {setting?.model
              ? `${copy.backendSetting}${setting.updatedAt ? ` · ${new Date(setting.updatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC` : ""}`
              : copy.envFallback}
          </div>
          <div className={`${muted} mt-1 text-[12px]`}>{copy.appliesNote}</div>
        </section>

        {!catalogOk && (
          <p role="alert" className="text-[13px] text-(--yellow)">
            {copy.catalogError}
          </p>
        )}

        <div className="mb-2.5 flex items-center gap-2.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            className={`${inputClasses} flex-1`}
          />
          <span className={`${muted} text-[12px] whitespace-nowrap`}>
            {copy.modelsCount.replace("{count}", String(filtered.length))}
          </span>
        </div>

        <div className="overflow-hidden rounded-(--radius-sm) border border-(--border)">
          <div
            className={`${rowGrid} cursor-default border-transparent border-b-(--border) text-[11px] uppercase tracking-[0.6px] text-(--muted)`}
          >
            <span>id</span>
            <span>{copy.contextLength}</span>
            <span>{copy.pricePrompt}</span>
            <span>{copy.priceCompletion}</span>
            <span>{copy.created}</span>
          </div>
          <div className="max-h-[52vh] overflow-y-auto">
            {loadingModels ? (
              <p className={`${muted} p-3 text-[13px]`}>…</p>
            ) : filtered.length === 0 ? (
              <p className={`${muted} p-3 text-[13px]`}>{copy.noResults}</p>
            ) : (
              filtered.map((m) => {
                const selected = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedId(m.id)}
                    className={`${rowGrid} cursor-pointer rounded-(--radius-sm)! text-[13px]! text-inherit ${
                      selected
                        ? "border-(--accent) bg-[rgba(94,234,212,0.1)]"
                        : "border-transparent bg-transparent"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`${mono} block break-all`}>
                        {m.id}
                        {m.prompt === "0" && (
                          <span className="ml-1.5 text-[11px] text-(--green)">
                            {copy.free.toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className={`${muted} block text-[11px]`}>{m.name}</span>
                    </span>
                    <span className={mono}>{fmtContext(m.contextLength)}</span>
                    <span className={mono}>{fmtPrice(m.prompt)}</span>
                    <span className={mono}>{fmtPrice(m.completion)}</span>
                    <span className={mono}>{fmtCreated(m.created)}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-3">
          <button
            type="button"
            onClick={apply}
            disabled={!selectedId || applying || !catalogOk}
            className={buttonClasses}
          >
            {applying ? copy.applying : copy.apply}
          </button>
          <div aria-live="polite" className="text-[13px]">
            {applyState?.kind === "ok" && <span className="text-(--green)">{copy.saved}</span>}
            {applyState?.kind === "error" && <span className="text-(--red)">{applyState.message}</span>}
          </div>
        </div>
      </div>
    </main>
  );
}
