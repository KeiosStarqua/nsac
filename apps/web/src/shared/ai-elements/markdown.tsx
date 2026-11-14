/**
 * Markdown — the assistant reply renderer. `react-markdown` + `remark-gfm` are already dependencies
 * (see `apps/web/package.json`); this file only supplies the typography, because the app runs
 * Tailwind without Preflight and the global reset strips list markers and paddings.
 *
 * The reply is model output: it is rendered as Markdown (never as HTML — no `rehype-raw`), and links
 * open in a new tab with `rel="noreferrer"`.
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "~/shared/lib/utils";

const prose = [
  // global.css resets p/ul/ol/h* without a cascade layer, which beats Tailwind's layered utilities;
  // the `!` keeps the Markdown typography authoritative inside a bubble.
  "[&_p]:my-0! [&_p+p]:mt-2!",
  "[&_ul]:my-0! [&_ul]:list-disc! [&_ul]:pl-5! [&_ol]:my-0! [&_ol]:list-decimal! [&_ol]:pl-5!",
  "[&_li]:my-0.5 [&_li]:marker:text-muted-foreground",
  "[&_a]:text-(--accent) [&_a]:underline [&_a]:underline-offset-2",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_code]:rounded [&_code]:bg-black/30 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-(family-name:--mono) [&_code]:text-[0.92em]",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/40 [&_pre]:p-3",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_h1]:mb-1! [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1! [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1! [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_hr]:my-3 [&_hr]:border-border",
  "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse",
  "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
  "[&_img]:max-w-full",
].join(" ");

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("min-w-0 text-sm leading-relaxed", prose, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren, ...rest }) => (
            <a href={href} target="_blank" rel="noreferrer" {...rest}>
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
