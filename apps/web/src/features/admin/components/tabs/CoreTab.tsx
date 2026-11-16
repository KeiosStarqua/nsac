import { useEffect, useState } from "react";
import { format, useCopy } from "~/shared/i18n";
import { getAgentCoreFn, setAgentCoreFn, type AgentCoreId } from "~/features/agent/api/agent-core.functions";
import { useAdminGate } from "../admin-gate";
import { Cpu } from "lucide-react";
import {
  buttonClasses,
  muted,
  sectionCard,
  sectionHeader,
  sectionIcon,
  sectionTitle,
  statusDot,
  statusPill,
} from "./classes";

type ApplyState = { kind: "ok"; message: string } | { kind: "error"; message: string } | null;

const OPTIONS: ReadonlyArray<AgentCoreId> = ["pi", "mastra"];

function stamp(ms: number): string {
  return `${new Date(ms).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

/**
 * `/admin/core` — the agent-core switch (dual-core, HARNESSING §18).
 *
 * Two radio cards: **Pi SDK** (default; per-astronaut JSONL sessions, the `show_on_hud` tool, SSE
 * token-by-token) and **Mastra** (beta; `@mastra/core` model router + Bedrock through the AI SDK,
 * LibSQL memory). Apply writes the backend `agent.core` row; the next chat turn picks the new core
 * up (the session cache key is `${core}:${provider}:${model}`, so the old session is evicted).
 */
export function CoreTab() {
  const copy = useCopy().admin;
  const { lock } = useAdminGate();

  const [current, setCurrent] = useState<AgentCoreId>("pi");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selection, setSelection] = useState<AgentCoreId>("pi");
  const [applying, setApplying] = useState(false);
  const [applyState, setApplyState] = useState<ApplyState>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    getAgentCoreFn()
      .then((r) => {
        if (cancelled) return;
        if (r.status === "ok") {
          setCurrent(r.core);
          setSelection(r.core);
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
      const r = await setAgentCoreFn({ data: { core: selection } });
      if (r.status === "ok") {
        setCurrent(r.core);
        setSelection(r.core);
        setUpdatedAt(r.updatedAt);
        setApplyState({ kind: "ok", message: copy.coreSaved });
      } else if (r.status === "invalid_core") {
        setApplyState({ kind: "error", message: copy.coreInvalid });
      } else if (r.status === "backend_error") {
        setApplyState({ kind: "error", message: copy.coreSaveFailed });
      } else {
        lock();
      }
    } catch {
      setApplyState({ kind: "error", message: copy.coreSaveFailed });
    } finally {
      setApplying(false);
    }
  }

  const optionLabel = (id: AgentCoreId) => (id === "mastra" ? copy.coreMastra : copy.corePi);
  const optionDesc = (id: AgentCoreId) => (id === "mastra" ? copy.coreMastraDesc : copy.corePiDesc);

  const statusLine = loadFailed
    ? copy.coreLoadFailed
    : updatedAt === null
      ? copy.coreNotConfigured
      : format(copy.coreUpdated, { time: stamp(updatedAt) });

  return (
    <section aria-label={copy.coreTitle} className={sectionCard}>
      <div className={sectionHeader}>
        <h2 className={sectionTitle}>
          <Cpu aria-hidden className={sectionIcon} strokeWidth={1.75} />
          {copy.coreTitle}
        </h2>
        {loaded && !loadFailed && (
          <span className={statusPill(current === "pi" ? "ok" : "mute")}>
            <span aria-hidden className={statusDot(current === "pi" ? "ok" : "mute")} />
            {optionLabel(current)}
          </span>
        )}
      </div>
      <p className={`${muted} mt-2 max-w-[68ch] text-[12px] leading-5`}>{copy.coreDescription}</p>

      <div className="mt-2 text-[12px] leading-5">
        <span className={muted}>{copy.coreCurrent}: </span>
        <span className="font-semibold">{optionLabel(current)}</span>
        <span className={muted}> · {statusLine}</span>
      </div>

      <div role="radiogroup" aria-label={copy.coreTitle} className="mt-3 grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((id) => {
          const selected = selection === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setSelection(id);
                setApplyState(null);
              }}
              disabled={applying || !loaded}
              className={`cursor-pointer rounded-(--radius-sm)! border px-3.5 py-3 text-left text-[14px] disabled:opacity-60 transition-colors ${
                selected ? "border-(--accent) bg-(--accent-subtle)" : "border-(--border) bg-transparent hover:border-(--accent)/50"
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
          {applying ? copy.coreApplying : copy.coreApply}
        </button>
        <div aria-live="polite" className="text-[14px]">
          {applyState?.kind === "ok" && <span className="text-(--green)">{applyState.message}</span>}
          {applyState?.kind === "error" && <span className="text-(--red)">{applyState.message}</span>}
        </div>
      </div>

      <p className={`${muted} mt-3 border-t border-(--border-subtle) pt-3 text-[12px] leading-5`}>{copy.coreNote}</p>
    </section>
  );
}
