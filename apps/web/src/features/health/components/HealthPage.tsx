import { useState } from "react";
import { useCopy } from "~/shared/i18n";
import { getSnapshot, validateKey, checkModel } from "../api/health.functions";
import { listAgentRoster } from "../../agent/api/agent.functions";
import { overallLabel } from "../model/health";
import type { Snapshot } from "../api/health.functions";

function Badge({ state }: { state: string }) {
  return <span data-state={state}>{state}</span>;
}

type LiveResult = {
  provider: "opencode-go" | "openrouter" | "amazon-bedrock";
  status: "valid" | "invalid" | "unreachable" | "missing" | "unsupported";
  httpStatus: number | null;
  credit: number | null;
  limit: number | null;
};

export function HealthPage({ initial }: { initial: Snapshot }) {
  const copy = useCopy().health;
  const [snap, setSnap] = useState<Snapshot>(initial);
  const [live, setLive] = useState<LiveResult | null>(null);
  const [running, setRunning] = useState(false);
  const [modelResult, setModelResult] = useState<string | null>(null);
  const [roster, setRoster] = useState<any[] | null>(null);
  useState(() => { listAgentRoster().then(setRoster).catch(() => setRoster([])); return null; });

  async function runLive() {
    setRunning(true);
    try {
      const r = await validateKey();
      setLive(r);
      const m = await checkModel();
      setModelResult(m.result);
    } finally {
      setRunning(false);
    }
  }

  const copyDiag = () => {
    const text = snap.checks.map((c) => `${c.checkId}: ${c.state} — ${c.detail}`).join("\n");
    navigator.clipboard?.writeText(`Overall: ${snap.overall}\nChecked at: ${snap.checkedAt}\n\n${text}`);
  };
  const goKey = snap.openCodeGoKey;
  const goKeyAt =
    goKey.updatedAt != null ? `${new Date(goKey.updatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC` : "—";
  const goKeyLine =
    goKey.source === "env" ? copy.goKeyEnv : goKey.source === "file" ? copy.goKeyStored.replace("{at}", goKeyAt) : copy.goKeyMissing;

  return (
    <main className="mx-auto max-w-[900px] p-6 text-(--text)">
      <header className="mb-4">
        <h1>{copy.title}</h1>
        <div aria-live="polite">
          <Badge state={snap.overall} /> <strong>{overallLabel(snap.overall)}</strong>
          <span className="ml-3 text-(--text-muted)">checked at {snap.checkedAt}</span>
        </div>
        <p className="text-(--text-muted)">{copy.subtitle}</p>
      </header>

      <p className="mb-2 text-[13px] text-(--text-muted)">{goKeyLine}</p>
      <table className="w-full border-collapse">
        <thead>
          <tr><th>{copy.colCheck}</th><th>{copy.colStatus}</th><th>{copy.colDetail}</th><th>{copy.colHint}</th></tr>
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
        <section aria-live="polite" className="mt-4">
          <h2>{copy.liveTitle}</h2>
          <p>{live.provider} · {copy.liveKey}: {live.status} (HTTP {live.httpStatus ?? "n/a"})</p>
          {live.credit != null && <p>{copy.credits.replace("{count}", String(live.credit))}</p>}
          {live.limit != null && <p>{copy.limit.replace("{count}", String(live.limit))}</p>}
          {modelResult && <p>{copy.modelLine.replace("{result}", modelResult)}</p>}
        </section>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={runLive} disabled={running}>{running ? copy.running : copy.runLive}</button>
        <button onClick={copyDiag}>{copy.copyDiag}</button>
      </div>

      {roster && (
        <section className="mt-6">
          <h2>{copy.rosterTitle}</h2>
          <table className="w-full border-collapse">
            <thead><tr><th>{copy.colId}</th><th>{copy.colName}</th><th>{copy.colRole}</th><th>{copy.colModel}</th><th>{copy.colKey}</th><th>{copy.colProvider}</th></tr></thead>
            <tbody>
              {roster.map((r: any) => (
                <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.role}</td><td>{r.effectiveModel}</td><td>{r.keyConfigured ? "configured" : "missing"}</td><td>{r.provider ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-6">
        <h2>{copy.fixTitle}</h2>
        <p>{copy.fixBox}</p>
        <p>{copy.fixLocal}</p>
      </section>
    </main>
  );
}
