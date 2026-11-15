import { useCopy, useLocale } from "../../../shared/i18n";
import {
  dataCardUrl,
  formatCount,
  formatStat,
  type ResearchTask,
} from "../model/researchData";

const CHIP_BASE =
  "inline-flex items-center gap-1 rounded-full border px-2 py-[3px] font-mono text-[9px] uppercase tracking-[0.14em]";

const CHIP_COHORT = `${CHIP_BASE} border-[rgba(122,222,255,0.28)] bg-[rgba(11,36,58,0.45)] text-[#aee6ff]`;
const CHIP_WINDOW = `${CHIP_BASE} border-[rgba(94,234,212,0.30)] bg-[rgba(94,234,212,0.08)] text-[rgba(142,240,217,0.95)]`;
const CHIP_DELTA = `${CHIP_BASE} border-[rgba(196,181,253,0.30)] bg-[rgba(196,181,253,0.08)] text-[#d8cffb]`;

const NUMBER_LABEL = "text-[9.5px] uppercase tracking-[0.16em] text-(--muted)";
const NUMBER_VALUE = "font-mono text-[13px] tabular-nums text-(--text)";

/**
 * One research cohort card. Analog research data — the numbers describe the
 * cohort, never the fictional crew; the card says so on its face.
 */
export function ResearchCard({ task }: { task: ResearchTask }) {
  const copy = useCopy();
  const locale = useLocale();
  const card = copy.research.cards[task.id as keyof typeof copy.research.cards];
  const statLabel = task.statKind === "window" ? copy.research.statWindow : copy.research.statDelta;

  return (
    <article
      aria-labelledby={`research-card-${task.id}`}
      className="flex flex-col gap-2.5 rounded-[14px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,28,54,0.62),rgba(9,15,32,0.86))] p-4 shadow-[0_18px_40px_rgba(2,6,18,0.45)]"
    >
      <div className="flex items-start justify-between gap-2">
        <code className="font-mono text-[10px] leading-tight text-[#8fa3c8]">{task.id}</code>
        <span className={task.statKind === "window" ? CHIP_WINDOW : CHIP_DELTA}>{statLabel}</span>
      </div>

      <div>
        <h3 id={`research-card-${task.id}`} className="m-0! text-[15px] font-medium leading-snug text-(--text)">
          {card?.title ?? task.id}
        </h3>
        <p className="mt-0.5 mb-0! text-[10.5px] leading-snug text-(--muted)">{card?.subtitle ?? ""}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={CHIP_COHORT}>{task.cohort}</span>
      </div>
      <p className="m-0! flex items-center gap-1.5 text-[9px] uppercase leading-snug tracking-[0.14em] text-[rgba(251,191,36,0.78)]">
        <span aria-hidden="true" className="inline-block size-[5px] flex-none rounded-full bg-[rgba(251,191,36,0.85)]" />
        {copy.research.notThisCrew}
      </p>

      <div className="grid grid-cols-3 gap-2 border-t border-white/6 pt-2.5">
        <div>
          <p className={`m-0! ${NUMBER_LABEL}`}>{copy.research.medianLabel}</p>
          <p className={`m-0! mt-0.5 ${NUMBER_VALUE}`}>
            {formatStat(task.median)} <span className="text-[10px] text-(--muted)">{task.unit}</span>
          </p>
        </div>
        <div>
          <p className={`m-0! ${NUMBER_LABEL}`}>{copy.research.iqrLabel}</p>
          <p className={`m-0! mt-0.5 ${NUMBER_VALUE}`}>
            {formatStat(task.q1)}–{formatStat(task.q3)}
          </p>
        </div>
        <div>
          <p className={`m-0! ${NUMBER_LABEL}`}>{copy.research.rangeLabel}</p>
          <p className={`m-0! mt-0.5 ${NUMBER_VALUE}`}>
            {formatStat(task.min)}–{formatStat(task.max)}
          </p>
        </div>
      </div>

      <p className="m-0! font-mono text-[10px] tabular-nums text-(--muted)">
        {formatCount(task.rows, locale)} {copy.research.rowsLabel} · {formatCount(task.nSubjects, locale)}{" "}
        {copy.research.subjectsLabel}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/6 pt-2.5">
        <span className="font-mono text-[8.5px] uppercase leading-snug tracking-[0.12em] text-[#7186ad]">
          {task.licence}
        </span>
        <a
          href={dataCardUrl(task.id, task.runId)}
          target="_blank"
          rel="noreferrer noopener"
          className="flex-none font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#8ce7ff]! no-underline! hover:text-[#d3f6ff]! hover:underline! focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[#f5fcff]!"
        >
          {copy.research.dataCard} ↗
        </a>
      </div>
    </article>
  );
}
