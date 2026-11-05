import { useCallback, useEffect, useRef, useState } from "react";
import type { ScenarioSearch } from "~/shared/scenario/search";

export type AgentPhase = "idle" | "streaming" | "done" | "error";

export interface AgentRun {
  phase: AgentPhase;
  /** OpenUI Lang so far. */
  program: string;
  source: "ollama" | "built-in" | null;
  reason: string;
  /** The scenario this answer was written for, so the UI can say when it is out of date. */
  forScenario: ScenarioSearch | null;
  error: string | null;
}

const EMPTY: AgentRun = { phase: "idle", program: "", source: null, reason: "", forScenario: null, error: null };

export function useAgentStream() {
  const [run, setRun] = useState<AgentRun>(EMPTY);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(async (question: string, scenario: ScenarioSearch) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRun({ ...EMPTY, phase: "streaming", forScenario: scenario });

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, scenario }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

      const source = res.headers.get("x-agent-source") === "ollama" ? "ollama" : "built-in";
      const reason = decodeURIComponent(res.headers.get("x-agent-reason") ?? "");
      setRun((r) => ({ ...r, source, reason }));

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += value;
        setRun((r) => ({ ...r, program: text }));
      }
      setRun((r) => ({ ...r, phase: "done" }));
    } catch (error) {
      if (controller.signal.aborted) return;
      setRun((r) => ({ ...r, phase: "error", error: error instanceof Error ? error.message : "Something went wrong" }));
    }
  }, []);

  return { run, ask };
}
