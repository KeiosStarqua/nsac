interface InsightPanelProps {
  title: string;
  caption: string;
  text: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceTitle: string;
  methodTitle: string;
  methodNote: string;
  methods: Array<{ key: string; label: string }>;
  note: string;
}

const CARD = "rounded-2xl border border-[rgba(129,140,248,0.20)] bg-[linear-gradient(158deg,rgba(23,32,60,0.95),rgba(9,17,34,0.9))] p-5";

/**
 * The top-right "Sky insight" card: one deterministic sentence, its rule caption and the NASA
 * source, plus the method-badge legend and the quiet backend footnote. No LLM anywhere.
 */
export function InsightPanel({
  title,
  caption,
  text,
  sourceLabel,
  sourceUrl,
  sourceTitle,
  methodTitle,
  methodNote,
  methods,
  note,
}: InsightPanelProps) {
  return (
    <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
      <section className={`${CARD} relative overflow-hidden`}>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(94,234,212,0.7),rgba(167,139,250,0.7),transparent)]"
        />
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="relative grid size-2.5 flex-none place-items-center">
            <span className="absolute size-2.5 rounded-full bg-[#5eead4] opacity-40 blur-[3px]" />
            <span className="size-1.5 rounded-full bg-[#5eead4]" />
          </span>
          <h2 className="m-0! text-[10.5px] font-medium uppercase tracking-[0.22em] text-[#8ef0d9]">{title}</h2>
        </div>

        <p className="mt-3 mb-0! text-[15px] font-light leading-[1.55] text-(--text)">{text}</p>
        <p className="mt-3 mb-0! text-[9.5px] uppercase tracking-[0.16em] text-(--muted)/75">{caption}</p>

        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          title={sourceTitle}
          className="mt-4 flex items-start gap-2 text-[11px] leading-snug text-[#9aa9c4]! no-underline! hover:text-[#c8f7ec]!"
        >
          <span className="flex-none pt-[1px] text-[9px] uppercase tracking-[0.12em] text-(--muted)/70">{sourceLabel}</span>
          <span className="line-clamp-2 underline decoration-[rgba(148,163,184,0.35)] underline-offset-2">{sourceTitle}</span>
        </a>
      </section>

      <section className="rounded-2xl border border-white/8 bg-[rgba(13,20,36,0.72)] p-4">
        <h2 className="m-0! text-[10px] font-medium uppercase tracking-[0.2em] text-(--muted)">{methodTitle}</h2>
        <p className="mt-2 mb-0! text-[11px] leading-relaxed text-(--muted)/85">{methodNote}</p>
        <ul className="mt-3 mb-0! flex list-none flex-wrap gap-1.5 p-0">
          {methods.map((method) => (
            <li
              key={method.key}
              className="rounded-full border border-[rgba(148,163,184,0.22)] px-2 py-[3px] text-[9px] uppercase tracking-[0.1em] text-[rgba(154,169,196,0.9)]"
            >
              {method.label}
            </li>
          ))}
        </ul>
      </section>

      <p className="m-0! text-[9.5px] uppercase tracking-[0.14em] text-(--muted)/60">{note}</p>
    </aside>
  );
}
