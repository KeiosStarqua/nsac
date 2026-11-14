import { useState } from "react";
import { getSnapshot, validateOpenRouterKey, checkModel } from "../api/health.functions";
import { overallLabel } from "../model/health";
import type { Snapshot } from "../api/health.functions";

function Badge({ state }: { state: string }) {
  return <span className="badge" data-state={state}>{state}</span>;
}

export function HealthPage({ initial }: { initial: Snapshot }) {
  const [snap, setSnap] = useState<Snapshot>(initial);
  const [live, setLive] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [modelResult, setModelResult] = useState<string | null>(null);

  async function runLive() {
    setRunning(true);
    try {
      const r = await validateOpenRouterKey();
      setLive(r);
      const m = await checkModel();
      setModelResult(m.result);
    } finally {
      setRunning(false);
    }
  }

  function copyDiag() {
    const text = snap.checks.map((c) => `${c.checkId}: ${c.state} — ${c.detail}`).join("\n");
    navigator.clipboard?.writeText(`Overall: ${snap.overall}\nChecked at: ${snap.checkedAt}\n\n${text}`);
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "var(--text)" }}>
      <header style={{ marginBottom: 16 }}>
        <h1>Health</h1>
        <div aria-live="polite">
          <Badge state={snap.overall} /> <strong>{overallLabel(snap.overall)}</strong>
          <span style={{ marginLeft: 12, color: "var(--text-muted)" }}>checked at {snap.checkedAt}</span>
        </div>
        <p style={{ color: "var(--text-muted)" }}>Agent configuration readiness snapshot.</p>
      </header>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr><th>Check</th><th>Status</th><th>Detail</th><th>Hint</th></tr>
        </thead>
        <tbody>
          {snap.checks.map((c) => (
            <tr key={c.checkId}>
              <td>{c.label}</td>
              <td><Badge state={c.state} /></td>
              <td>{c.detail}</td>
              <td>{c.hint ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {live && (
        <section aria-live="polite" style={{ marginTop: 16 }}>
          <h2>Live checks</h2>
          <p>OpenRouter key: {live.status} (HTTP {live.httpStatus ?? "n/a"})</p>
          {live.credit != null && <p>Credits: {live.credit}</p>}
          {live.limit != null && <p>Limit: {live.limit}</p>}
          {modelResult && <p>Model: {modelResult}</p>}
        </section>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button onClick={runLive} disabled={running}>{running ? "Running…" : "Run live checks"}</button>
        <button onClick={copyDiag}>Copy diagnostics</button>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2>How to fix</h2>
        <p>On the box: edit <code>/etc/nsac-web/env</code> (SKY_OPENROUTER_API_KEY=...), then <code>systemctl restart nsac-web</code>.</p>
        <p>Locally: create <code>.env</code> with SKY_OPENROUTER_API_KEY.</p>
      </section>
    </main>
  );
}