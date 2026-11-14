import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
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

const page: CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
  fontFamily: "var(--font)",
};
const panel: CSSProperties = {
  maxWidth: 1040,
  margin: "0 auto",
  padding: "28px 20px 48px",
};
const mono: CSSProperties = { fontFamily: "var(--mono)" };
const muted: CSSProperties = { color: "var(--muted)" };
const inputStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  padding: "10px 12px",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};
const buttonStyle: CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-ink)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const rowGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 0.7fr)",
  gap: 8,
  alignItems: "baseline",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  color: "inherit",
  cursor: "pointer",
  fontSize: 13,
};

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
      <main style={page}>
        <div style={panel}>
          <p style={muted}>{copy.checking}</p>
        </div>
      </main>
    );
  }

  if (phase === "unconfigured") {
    return (
      <main style={page}>
        <div style={panel}>
          <h1 style={{ fontSize: 20 }}>{copy.title}</h1>
          <p style={muted}>{copy.notConfigured}</p>
        </div>
      </main>
    );
  }

  if (phase === "locked") {
    return (
      <main style={page}>
        <div style={{ ...panel, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, marginBottom: 16 }}>{copy.unlockTitle}</h1>
          <form onSubmit={submitUnlock}>
            <label htmlFor="sky-admin-key" style={{ ...muted, display: "block", fontSize: 13, marginBottom: 6 }}>
              {copy.keyLabel}
            </label>
            <input
              id="sky-admin-key"
              type="password"
              autoComplete="off"
              autoFocus
              value={key}
              onChange={(e) => setKey(e.target.value)}
              style={inputStyle}
            />
            {unlockError && (
              <p role="alert" style={{ color: "var(--red)", fontSize: 13, margin: "10px 0 0" }}>
                {unlockError}
              </p>
            )}
            <button type="submit" disabled={unlockBusy || key.length === 0} style={{ ...buttonStyle, marginTop: 14, opacity: unlockBusy || key.length === 0 ? 0.6 : 1 }}>
              {unlockBusy ? copy.unlocking : copy.unlock}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={panel}>
        <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>{copy.title}</h1>

        <section
          aria-label={copy.currentEffective}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ ...muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            {copy.currentEffective}
          </div>
          <div style={{ ...mono, fontSize: 16, marginTop: 4, wordBreak: "break-all" }}>
            {effectiveModel ?? "…"}
          </div>
          <div style={{ ...muted, fontSize: 12, marginTop: 6 }}>
            {setting?.model
              ? `${copy.backendSetting}${setting.updatedAt ? ` · ${new Date(setting.updatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC` : ""}`
              : copy.envFallback}
          </div>
          <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>{copy.appliesNote}</div>
        </section>

        {!catalogOk && (
          <p role="alert" style={{ color: "var(--yellow)", fontSize: 13 }}>
            {copy.catalogError}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            style={{ ...inputStyle, flex: 1 }}
          />
          <span style={{ ...muted, fontSize: 12, whiteSpace: "nowrap" }}>
            {copy.modelsCount.replace("{count}", String(filtered.length))}
          </span>
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              ...rowGrid,
              ...muted,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              borderBottom: "1px solid var(--border)",
              borderRadius: 0,
              cursor: "default",
            }}
          >
            <span>id</span>
            <span>{copy.contextLength}</span>
            <span>{copy.pricePrompt}</span>
            <span>{copy.priceCompletion}</span>
            <span>{copy.created}</span>
          </div>
          <div style={{ maxHeight: "52vh", overflowY: "auto" }}>
            {loadingModels ? (
              <p style={{ ...muted, padding: 12, fontSize: 13 }}>…</p>
            ) : filtered.length === 0 ? (
              <p style={{ ...muted, padding: 12, fontSize: 13 }}>{copy.noResults}</p>
            ) : (
              filtered.map((m) => {
                const selected = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedId(m.id)}
                    style={{
                      ...rowGrid,
                      background: selected ? "rgb(94 234 212 / 0.10)" : "transparent",
                      border: selected ? "1px solid var(--accent)" : "1px solid transparent",
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ ...mono, display: "block", wordBreak: "break-all" }}>
                        {m.id}
                        {m.prompt === "0" && (
                          <span style={{ color: "var(--green)", marginLeft: 6, fontSize: 11 }}>
                            {copy.free.toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span style={{ ...muted, display: "block", fontSize: 11 }}>{m.name}</span>
                    </span>
                    <span style={mono}>{fmtContext(m.contextLength)}</span>
                    <span style={mono}>{fmtPrice(m.prompt)}</span>
                    <span style={mono}>{fmtPrice(m.completion)}</span>
                    <span style={mono}>{fmtCreated(m.created)}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
          <button
            type="button"
            onClick={apply}
            disabled={!selectedId || applying || !catalogOk}
            style={{ ...buttonStyle, opacity: !selectedId || applying || !catalogOk ? 0.6 : 1 }}
          >
            {applying ? copy.applying : copy.apply}
          </button>
          <div aria-live="polite" style={{ fontSize: 13 }}>
            {applyState?.kind === "ok" && <span style={{ color: "var(--green)" }}>{copy.saved}</span>}
            {applyState?.kind === "error" && <span style={{ color: "var(--red)" }}>{applyState.message}</span>}
          </div>
        </div>
      </div>
    </main>
  );
}
