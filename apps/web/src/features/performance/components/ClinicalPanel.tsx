import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, LoaderCircle, RefreshCw, Stethoscope } from "lucide-react";
import { useCopy, useLocale } from "../../../shared/i18n";
import {
  acknowledgeFindingFn,
  listClinicalFindingsFn,
  summarizeMedicalCaseFn,
} from "../../clinical/api/clinical.functions";
import type { MedicalOfficerResult } from "../../agent/runtime/medical-officer.server";
import {
  relativeObservedAt,
  specialistLabel,
  toFindingRow,
  type FindingRow,
  type FindingTone,
} from "../model/clinical";
import type { ClinicalSeverity } from "../../clinical/model/findings";

const CARD =
  "rounded-2xl border border-[rgba(129,140,248,0.20)] bg-[linear-gradient(158deg,rgba(23,32,60,0.95),rgba(9,17,34,0.9))] p-5";

const POLL_MS = 60_000;

const SEVERITY_DOT: Record<FindingTone, string> = {
  green: "#34D399",
  yellow: "#FBBF24",
  red: "#F87171",
  unknown: "#94A3B8",
};

type Row = FindingRow;
type OfficerState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "result"; readonly result: Extract<MedicalOfficerResult, { status: "ok" } | { status: "empty" }> }
  | { readonly kind: "error" };

function SeverityDot({ severity, className = "size-2" }: { severity: ClinicalSeverity; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block flex-none rounded-full ${className}`}
      style={{ backgroundColor: SEVERITY_DOT[severity], boxShadow: `0 0 8px ${SEVERITY_DOT[severity]}66` }}
    />
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="size-2.5 flex-none rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-2 w-2/5 animate-pulse rounded bg-white/8" />
            <div className="h-2 w-4/5 animate-pulse rounded bg-white/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ClinicalPanelProps {
  readonly astronautId: string;
}

/**
 * `/performance` — Clinical findings panel. Simulated telemetry findings from the backend's
 * deterministic monitoring engine, acknowledged by the human (never by the AI), plus a one-shot
 * "Ask Sky Medical Officer" synthesis. No severity editing, no medical actions, no diagnosis
 * language — the AI summarizes and flags review; it never decides.
 */
export function ClinicalPanel({ astronautId }: ClinicalPanelProps) {
  const copy = useCopy();
  const locale = useLocale();
  const [rows, setRows] = useState<Row[] | null>(null); // null = loading
  const [reachable, setReachable] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [officer, setOfficer] = useState<OfficerState>({ kind: "idle" });
  const rowsRef = useRef<Row[] | null>(null);
  rowsRef.current = rows;

  // Initial load + 60 s poll (skipped while the tab is hidden); re-loads on astronaut change.
  useEffect(() => {
    let alive = true;
    setRows(null);
    setActionError(null);
    setOfficer({ kind: "idle" });
    const load = async () => {
      try {
        const res = await listClinicalFindingsFn({ data: { astronautId } });
        if (!alive) return;
        if (res.ok) {
          setRows(res.findings.map(toFindingRow));
          setReachable(true);
        } else {
          setReachable(false);
          setRows((prev) => prev ?? []);
        }
      } catch {
        if (!alive) return;
        setReachable(false);
        setRows((prev) => prev ?? []);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void load();
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [astronautId]);

  const acknowledge = useCallback(
    async (id: string, action: "reviewed" | "resolved") => {
      if (pendingId) return;
      const snapshot = rowsRef.current;
      setPendingId(id);
      setActionError(null);
      // Optimistic: reviewed → badge flips; resolved → row leaves the open list.
      setRows((current) =>
        action === "resolved"
          ? (current ?? []).filter((row) => row.id !== id)
          : (current ?? []).map((row) => (row.id === id ? { ...row, status: "reviewed" } : row)),
      );
      try {
        const res = await acknowledgeFindingFn({ data: { id, action } });
        if (!res.ok) throw new Error(res.error);
      } catch {
        setRows(snapshot); // rollback on failure
        setActionError(copy.clinical.actionFailed);
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, copy.clinical.actionFailed],
  );

  const askOfficer = useCallback(async () => {
    setOfficer({ kind: "loading" });
    try {
      const res = await summarizeMedicalCaseFn({ data: { astronautId, locale } });
      if (res.status === "unavailable") {
        setOfficer({ kind: "error" });
        return;
      }
      setOfficer({ kind: "result", result: res });
    } catch {
      setOfficer({ kind: "error" });
    }
  }, [astronautId, locale]);

  return (
    <section className={`${CARD} relative overflow-hidden`} id="clinical-findings" aria-label={copy.clinical.title}>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(248,113,113,0.5),rgba(251,191,36,0.5),transparent)]"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="relative grid size-2.5 flex-none place-items-center">
              <span className="absolute size-2.5 rounded-full bg-[#fb7185] opacity-40 blur-[3px]" />
              <span className="size-1.5 rounded-full bg-[#fb7185]" />
            </span>
            <h2 className="m-0! text-[10.5px] font-medium uppercase tracking-[0.22em] text-[#fda4af]">
              {copy.clinical.title}
            </h2>
            <span className="rounded-full border border-[rgba(234,179,8,0.35)] bg-[rgba(234,179,8,0.10)] px-1.5 py-[2px] text-[8px] font-semibold uppercase tracking-[0.18em] text-[#fde68a]">
              {copy.performance.simulatedTag}
            </span>
          </div>
          <p className="mt-2 mb-0! text-[10.5px] leading-snug text-(--muted)/85">{copy.clinical.disclaimerLine}</p>
        </div>
        <button
          type="button"
          onClick={() => void askOfficer()}
          disabled={officer.kind === "loading"}
          className="inline-flex flex-none items-center gap-2 rounded-full border border-[rgba(122,222,255,0.35)] bg-[rgba(11,36,58,0.55)] px-3 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#aee6ff] [transition:border-color_.18s,background-color_.18s,color_.18s] hover:border-[#8ce7ff] hover:bg-[rgba(20,62,94,0.6)] hover:text-[#e6fbff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8ce7ff] disabled:cursor-wait disabled:opacity-60"
        >
          {officer.kind === "loading" ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Stethoscope className="size-3.5" aria-hidden="true" />
          )}
          {copy.clinical.askOfficer}
        </button>
      </div>

      {/* Action error — inline, never a toast that hides the rollback */}
      {actionError ? (
        <p role="alert" className="mt-3 mb-0! text-[11px] leading-snug text-[#fda4af]">
          {actionError}
        </p>
      ) : null}

      {/* Findings list */}
      <div className="mt-4 flex flex-col gap-2.5" aria-busy={rows === null}>
        {rows === null ? <SkeletonRows /> : null}
        {rows !== null && rows.length === 0 && reachable ? (
          <p className="m-0! rounded-xl border border-white/8 bg-[rgba(13,20,36,0.6)] px-4 py-5 text-center text-[12px] text-(--muted)">
            {copy.clinical.empty}
          </p>
        ) : null}
        {rows !== null
          ? rows.map((row) => (
              <article
                key={row.id}
                className="flex flex-col gap-2 rounded-xl border border-white/8 bg-[rgba(13,20,36,0.72)] px-3.5 py-3"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-[5px]">
                    <SeverityDot severity={row.severity} className="size-2.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="m-0! text-[12px] font-medium text-(--text)">{row.specialist}</p>
                      <p className="m-0! text-[9.5px] uppercase tracking-[0.14em] text-(--muted)/75">
                        {relativeObservedAt(row.observedAt, locale) ?? ""}
                      </p>
                    </div>
                    <p className="mt-1 mb-0! text-[12px] leading-snug text-(--text)/90">{row.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-[rgba(148,163,184,0.25)] px-1.5 py-[2px] text-[8px] font-semibold uppercase tracking-[0.14em] text-[rgba(154,169,196,0.95)]">
                        {row.dataKindChip}
                      </span>
                      <span className="rounded-full border border-[rgba(148,163,184,0.18)] px-1.5 py-[2px] text-[8px] uppercase tracking-[0.14em] text-(--muted)/85">
                        {row.quality}
                      </span>
                      {row.status === "reviewed" ? (
                        <span className="rounded-full border border-[rgba(94,234,212,0.3)] bg-[rgba(94,234,212,0.08)] px-1.5 py-[2px] text-[8px] font-semibold uppercase tracking-[0.14em] text-[#8ef0d9]">
                          {copy.clinical.reviewedPill}
                        </span>
                      ) : null}
                      {row.requiresMedicalReview ? (
                        <span className="rounded-full border border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.10)] px-1.5 py-[2px] text-[8px] font-semibold uppercase tracking-[0.14em] text-[#fca5a5]">
                          {copy.clinical.reviewPill}
                        </span>
                      ) : null}
                      {row.methodUrl ? (
                        <a
                          href={row.methodUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[9px] uppercase tracking-[0.12em] text-[#9aa9c4]! no-underline! underline decoration-[rgba(148,163,184,0.35)] underline-offset-2 hover:text-[#c8f7ec]!"
                        >
                          {copy.clinical.methodLink} ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-1">
                    {row.status === "new" ? (
                      <button
                        type="button"
                        onClick={() => void acknowledge(row.id, "reviewed")}
                        disabled={pendingId === row.id}
                        title={copy.clinical.markReviewed}
                        aria-label={copy.clinical.markReviewedAria}
                        className="grid size-8 place-items-center rounded-full border border-transparent text-[#8ef0d9] [transition:background-color_.15s,border-color_.15s] hover:border-[rgba(94,234,212,0.35)] hover:bg-[rgba(94,234,212,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8ce7ff] disabled:opacity-40"
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void acknowledge(row.id, "resolved")}
                      disabled={pendingId === row.id}
                      title={copy.clinical.resolve}
                      aria-label={copy.clinical.resolveAria}
                      className="grid size-8 place-items-center rounded-full border border-transparent text-[#aee6ff] [transition:background-color_.15s,border-color_.15s] hover:border-[rgba(122,222,255,0.35)] hover:bg-[rgba(122,222,255,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8ce7ff] disabled:opacity-40"
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ))
          : null}
        {reachable ? null : (
          <p className="m-0! text-[9.5px] uppercase tracking-[0.14em] text-(--muted)/60">
            {copy.clinical.unavailable}
          </p>
        )}
      </div>

      {/* Officer result — inline, below the findings */}
      {officer.kind !== "idle" ? (
        <div className="mt-4 rounded-xl border border-[rgba(122,222,255,0.18)] bg-[rgba(9,25,44,0.6)] px-4 py-3.5">
          {officer.kind === "loading" ? (
            <div className="flex items-center gap-2.5 text-[11.5px] text-(--muted)">
              <LoaderCircle className="size-4 animate-spin text-[#8ce7ff]" aria-hidden="true" />
              {copy.clinical.officerLoading}
            </div>
          ) : null}
          {officer.kind === "error" ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0! text-[11.5px] text-[#fda4af]">{copy.clinical.officerError}</p>
              <button
                type="button"
                onClick={() => void askOfficer()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(122,222,255,0.3)] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#aee6ff] hover:border-[#8ce7ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8ce7ff]"
              >
                <RefreshCw className="size-3" aria-hidden="true" />
                {copy.clinical.officerRetry}
              </button>
            </div>
          ) : null}
          {officer.kind === "result" && officer.result.status === "empty" ? (
            <p className="m-0! text-[12px] text-(--muted)">{copy.clinical.empty}</p>
          ) : null}
          {officer.kind === "result" && officer.result.status === "ok" ? (
            <div>
              <p className="m-0! text-[13px] leading-relaxed text-(--text)">{officer.result.summary}</p>
              {officer.result.keyFindings.length > 0 ? (
                <ul className="mt-2.5 mb-0! flex list-none flex-col gap-1.5 p-0">
                  {officer.result.keyFindings.map((kf, index) => (
                    <li key={`${kf.specialistId}-${index}`} className="flex items-start gap-2 text-[11.5px] leading-snug text-(--text)/90">
                      <span className="mt-[5px]">
                        <SeverityDot severity={kf.severity} className="size-1.5" />
                      </span>
                      <span>
                        <span className="font-medium text-(--text)">{specialistLabel(kf.specialistId)}</span>
                        {" — "}
                        {kf.oneLine}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {officer.result.requiresMedicalReview ? (
                  <span className="rounded-full border border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.12)] px-2 py-[3px] text-[8.5px] font-semibold uppercase tracking-[0.16em] text-[#fca5a5]">
                    {copy.clinical.officerRequiresReview}
                  </span>
                ) : null}
                <span className="text-[9px] uppercase tracking-[0.14em] text-(--muted)/80">
                  {officer.result.generatedBy === "pi-sdk"
                    ? copy.clinical.officerPiSdk
                    : copy.clinical.officerDeterministic}
                </span>
              </div>
              <p className="mt-2.5 mb-0! border-t border-white/8 pt-2.5 text-[9.5px] leading-snug text-(--muted)">
                {locale === "vi" ? officer.result.disclaimerVi : officer.result.disclaimer}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
