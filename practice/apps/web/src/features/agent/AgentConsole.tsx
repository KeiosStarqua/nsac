import { useState } from "react";
import { OpenUiView } from "~/features/briefing";
import { useScenario } from "~/features/scenario";
import { useAgentStream } from "./use-agent-stream";

const PRESETS = [
  "Brief me on the flu situation.",
  "What should we do next, and why?",
  "Who is the most at risk right now?",
];

export function AgentConsole() {
  const { seed, day, iv } = useScenario();
  const { run, ask } = useAgentStream();
  const [question, setQuestion] = useState(PRESETS[0]!);

  const current = { seed, day, iv };
  const stale =
    run.forScenario !== null &&
    (run.forScenario.day !== day ||
      run.forScenario.seed !== seed ||
      run.forScenario.iv.join("|") !== iv.join("|"));
  const busy = run.phase === "streaming";

  return (
    <div className="stack">
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && question.trim()) void ask(question.trim(), current);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          aria-label="Question for the ship AI"
        />
        <button type="submit" className="primary" disabled={busy || !question.trim()}>
          {busy ? "Thinking…" : "Ask"}
        </button>
      </form>
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p} type="button" className="chip chip-button" onClick={() => setQuestion(p)}>
            {p}
          </button>
        ))}
      </div>

      {run.source ? (
        <p className="muted source">
          {run.source === "ollama"
            ? "Written by the local AI model (Ollama). It only proposes; you decide."
            : `Built-in briefing, no AI model used. ${run.reason}`}
        </p>
      ) : null}
      {stale && run.phase === "done" ? (
        <p className="page-note">This answer is for day {run.forScenario?.day}. The ship has changed; ask again.</p>
      ) : null}
      {run.phase === "error" ? <p className="page-note error">{run.error}</p> : null}

      {run.program ? <OpenUiView program={run.program} streaming={busy} /> : null}
      <small className="muted">AI-generated, not a substitute for a physician. Toy simulation.</small>
    </div>
  );
}
