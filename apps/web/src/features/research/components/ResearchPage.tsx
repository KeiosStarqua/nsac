import { Link } from "@tanstack/react-router";
import { useCopy } from "../../../shared/i18n";
import { ResearchCard } from "./ResearchCard";
import { RESEARCH_GROUPS, researchData, type ResearchGroup } from "../model/researchData";

const PAGE_BACKDROP =
  "bg-[radial-gradient(120%_85%_at_82%_-12%,rgba(90,78,236,0.20),transparent_56%),radial-gradient(95%_70%_at_-5%_0%,rgba(16,116,148,0.22),transparent_62%),linear-gradient(180deg,#070b14_0%,#060a12_62%,#04070e_100%)]";

const BRAND_RING = [
  "relative grid size-[38px] flex-none place-items-center rounded-full border-2 border-transparent",
  "[background:linear-gradient(#09192c,#09192c)_padding-box,conic-gradient(from_55deg,transparent_8%,#8defff_28%,#a4aaff_50%,#fff_70%,#8ca6ff_82%,transparent_100%)_border-box]",
  "shadow-[0_0_16px_rgba(105,192,255,0.24),inset_0_0_8px_rgba(108,156,255,0.14)]",
].join(" ");

const NAV_LINK = [
  "inline-flex items-center gap-1.5 rounded-full border border-[rgba(122,222,255,0.30)] bg-[rgba(11,36,58,0.45)]",
  "px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#aee6ff]! no-underline!",
  "[transition:border-color_.18s,background_.18s,color_.18s]",
  "hover:border-[#8ce7ff] hover:bg-[rgba(20,62,94,0.5)] hover:text-[#e6fbff]!",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#f5fcff]!",
].join(" ");

const GROUP_HEADING =
  "m-0! flex items-baseline gap-3 border-b border-white/8 pb-2 text-[12px] font-medium uppercase tracking-[0.2em] text-[#c7d2fe]";

/**
 * `/research` — SKY / Research Evidence. A read-only view of the NASA analog
 * cohort research datasets bundled in `src/features/research/research-data.json`
 * (generated at authoring time by `apps/web/scripts/extract-research.mjs` from the
 * read-only `data/` submodule). No cohort value is assigned to the fictional
 * crew; the page says so on every card. No 3D, no agent call, no auth, no fetch.
 */
export function ResearchPage() {
  const copy = useCopy();
  const tasks = researchData.tasks;
  const tasksByGroup = new Map<ResearchGroup, typeof tasks>();
  for (const group of RESEARCH_GROUPS) tasksByGroup.set(group, []);
  for (const task of tasks) tasksByGroup.get(task.group)?.push(task);

  return (
    <main
      className={`relative min-h-dvh w-full overflow-x-clip text-(--text) [font-family:Inter,Manrope,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif] [font-synthesis:none] ${PAGE_BACKDROP}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_50%_38%,transparent_55%,rgba(2,6,14,0.55)_100%)]"
      />

      <div className="relative z-[1] mx-auto w-full max-w-[1440px] px-4 pb-9 pt-6 sm:px-7 sm:pt-7 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3.5">
            <span aria-hidden="true" className={BRAND_RING}>
              <span className="size-[7px] rounded-full bg-[#8ef0d9] shadow-[0_0_11px_#5eead4]" />
            </span>
            <div>
              <h1 className="m-0! text-[15px] font-light uppercase leading-tight tracking-[0.2em] text-(--text) sm:text-[19px]">
                {copy.research.brand}
              </h1>
              <p className="mt-1 mb-0! text-[10px] uppercase leading-relaxed tracking-[0.18em] text-(--muted)">
                {copy.research.brandSub}
              </p>
            </div>
          </div>

          <nav aria-label={copy.research.brand} className="flex flex-none flex-wrap items-center gap-2">
            <Link to="/performance" search={(prev) => prev} className={NAV_LINK}>
              <span aria-hidden="true">←</span>
              {copy.research.backPerformance}
            </Link>
            <Link to="/" search={(prev) => prev} className={NAV_LINK}>
              {copy.research.backToHud}
              <span aria-hidden="true">→</span>
            </Link>
          </nav>
        </header>

        <div className="mt-4 flex flex-col gap-2">
          <p className="m-0! flex flex-wrap items-center gap-2 text-[10px] uppercase leading-relaxed tracking-[0.16em] text-[#aee6ff]">
            <span className="inline-flex items-center rounded-[4px] border border-[rgba(251,191,36,0.45)] bg-[rgba(251,191,36,0.10)] px-1.5 py-[2px] font-mono text-[8.5px] tracking-[0.2em] text-[rgba(253,224,141,0.95)]">
              {copy.research.badge}
            </span>
            <span>{copy.research.contextLine}</span>
          </p>
          <p className="m-0! text-[9.5px] uppercase leading-relaxed tracking-[0.18em] text-[rgba(251,191,36,0.78)]">
            {copy.research.disclaimerLine}
          </p>
        </div>

        <p className="m-0! mt-4 max-w-[110ch] text-[11px] leading-relaxed text-(--muted)">{copy.research.legend}</p>

        {tasks.length === 0 ? (
          <p className="mt-6 rounded-[14px] border border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.06)] p-5 text-[12px] leading-relaxed text-[rgba(253,224,141,0.9)]">
            {copy.research.emptyState}
          </p>
        ) : (
          RESEARCH_GROUPS.map((group) => {
            const groupTasks = tasksByGroup.get(group) ?? [];
            if (groupTasks.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`research-group-${group}`} className="mt-7">
                <h2 id={`research-group-${group}`} className={GROUP_HEADING}>
                  {copy.research.groups[group]}
                  <span aria-hidden="true" className="font-mono text-[10px] font-normal tracking-normal text-[#7186ad]">
                    {groupTasks.length}
                  </span>
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                  {groupTasks.map((task) => (
                    <ResearchCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            );
          })
        )}

        <section
          aria-labelledby="research-provenance"
          className="mt-8 rounded-[14px] border border-white/8 bg-[rgba(11,18,38,0.55)] p-5"
        >
          <h2 id="research-provenance" className="m-0! text-[12px] font-medium uppercase tracking-[0.2em] text-[#c7d2fe]">
            {copy.research.provenanceTitle}
          </h2>
          <p className="mt-2 mb-0! max-w-[110ch] text-[11.5px] leading-relaxed text-(--muted)">
            {copy.research.provenanceBody}
          </p>
          <p className="mt-2 mb-0! max-w-[110ch] text-[11.5px] leading-relaxed text-(--muted)">
            {copy.research.provenanceCatalog}{" "}
            <Link to="/data" className="text-[#8ce7ff]! no-underline! hover:underline!">
              {copy.research.provenancePipeline} →
            </Link>
          </p>
          <p className="mt-2 mb-0! font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-[#7186ad]">
            {copy.research.provenanceLicences}
          </p>
        </section>

        <footer className="mt-7 flex flex-col gap-4 border-t border-white/8 pt-5 text-[11px] text-(--muted) sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0! max-w-[76ch] leading-relaxed">{copy.research.disclaimer}</p>
          <p className="m-0! flex-none font-mono text-[9.5px] uppercase tracking-[0.18em] text-[rgba(251,191,36,0.78)]">
            {copy.research.notMedicalAdvice}
          </p>
        </footer>
      </div>
    </main>
  );
}
