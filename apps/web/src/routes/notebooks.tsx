import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useCopy } from "~/shared/i18n";

// ssr: true — a static chrome bar around a client-side iframe; nothing to fetch, no loader,
// no search params. `noindex,nofollow`: marimo is a util behind the same-origin `/marimo/`
// path, not a landing page (/research sets no robots meta; admin sets this one).
export const Route = createFileRoute("/notebooks")({
  ssr: true,
  head: () => ({
    meta: [
      { title: "SKY / Notebooks" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: NotebooksPage,
});

const CHROME_LINK = [
  "inline-flex flex-none items-center gap-1.5 rounded-full border border-[rgba(122,222,255,0.30)] bg-[rgba(11,36,58,0.45)]",
  "px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#aee6ff]! no-underline!",
  "[transition:border-color_.18s,background_.18s,color_.18s]",
  "hover:border-[#8ce7ff] hover:bg-[rgba(20,62,94,0.5)] hover:text-[#e6fbff]!",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#f5fcff]!",
].join(" ");

/**
 * `/notebooks` — Sky chrome around the read-only marimo instance that serves the eight
 * NASA-analog data notebooks. marimo runs on 127.0.0.1:8200 and Caddy publishes it
 * same-origin at `/marimo/` (WebSocket included), so the page embeds `/marimo/` in an
 * iframe and never proxies it — the web app must not depend on the marimo server at
 * build, SSR or request time. Read-only: no editing affordances are added here.
 */
function NotebooksPage() {
  const copy = useCopy();

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-[#070b14] text-(--text) [font-family:Inter,Manrope,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif]">
      <header
        data-notebooks-chrome=""
        className="flex h-12 flex-none items-center justify-between gap-2 border-b border-[rgba(122,222,255,0.18)] bg-[rgba(11,36,58,0.55)] px-2 sm:gap-4 sm:px-4"
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link to="/" className={CHROME_LINK} aria-label={copy.notebooks.back}>
            <span aria-hidden="true">←</span>
            <span className="max-[480px]:hidden">{copy.notebooks.back}</span>
          </Link>
          <h1 className="m-0! truncate text-[12px] font-medium uppercase leading-none tracking-[0.24em] text-[#aee6ff]">
            {copy.notebooks.title}
          </h1>
        </div>
        <a
          href="/marimo/"
          target="_blank"
          rel="noopener noreferrer"
          className={CHROME_LINK}
          aria-label={copy.notebooks.openNewTab}
        >
          <span className="max-[640px]:hidden">{copy.notebooks.openNewTab}</span>
          <ExternalLink aria-hidden="true" className="size-[11px] flex-none" />
        </a>
      </header>
      <p className="m-0! flex-none border-b border-white/5 px-2 py-1 text-[10px] leading-snug text-(--muted) sm:px-4">
        {copy.notebooks.fallback}{" "}
        <a
          href="/marimo/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#aee6ff] underline underline-offset-2 hover:text-[#e6fbff]"
        >
          /marimo/
        </a>
      </p>
      <iframe
        src="/marimo/"
        title="Notebooks viewer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
        className="h-full min-h-0 w-full flex-1 border-0"
      />
    </main>
  );
}
